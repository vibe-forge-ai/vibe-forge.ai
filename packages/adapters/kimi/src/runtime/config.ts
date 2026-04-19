/* eslint-disable max-lines */

import { accessSync, constants } from 'node:fs'
import { copyFile, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, resolve } from 'node:path'
import process from 'node:process'

import type { AdapterCtx, AdapterQueryOptions, Config, ModelServiceConfig } from '@vibe-forge/types'
import { parseServiceModelSelector, syncSymlinkTarget } from '@vibe-forge/utils'

import { resolveKimiBinaryPath } from '../paths'
import type { KimiAdapterConfig, KimiProviderType } from './common'
import {
  buildKimiAgentFileContent,
  deepMerge,
  normalizeStringRecord,
  resolveAdapterConfig,
  resolveReportedToolNames,
  resolveRequestedThinking,
  toProcessEnv
} from './common'
import { mergeKimiNativeHooksIntoJsonConfig, mergeKimiNativeHooksIntoTomlConfig } from './native-hooks'

export interface KimiSessionBase {
  binaryPath: string
  cliModel?: string
  copiedConfigPath?: string
  cwd: string
  mcpConfigPath?: string
  reportedAgent?: string
  reportedModel?: string
  shareDir: string
  skillsDir?: string
  spawnEnv: Record<string, string>
  thinking?: boolean
  toolNames: string[]
  turnArgPrefix: string[]
}

const DEFAULT_CONTEXT_SIZE = 262144

const asPlainRecord = (value: unknown): Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
)

const normalizePositiveInteger = (value: unknown): number | undefined => (
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : undefined
)

const pathExists = (targetPath: string) => {
  try {
    accessSync(targetPath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

const appendQueryParams = (baseUrl: string, queryParams: Record<string, string>) => {
  if (Object.keys(queryParams).length === 0) return baseUrl
  const url = new URL(baseUrl)
  for (const [key, value] of Object.entries(queryParams)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

const normalizeProviderBaseUrl = (baseUrl: string, providerType: KimiProviderType) => {
  if (providerType === 'openai_responses') return baseUrl.replace(/\/responses\/?$/u, '')
  if (providerType === 'kimi' || providerType === 'openai_legacy') {
    return baseUrl.replace(/\/chat\/completions\/?$/u, '')
  }
  return baseUrl
}

const inferProviderType = (params: {
  apiBaseUrl?: string
  providerType?: string
  modelName: string
}): KimiProviderType => {
  if (
    params.providerType === 'kimi' ||
    params.providerType === 'openai_legacy' ||
    params.providerType === 'openai_responses' ||
    params.providerType === 'anthropic' ||
    params.providerType === 'gemini' ||
    params.providerType === 'vertexai'
  ) {
    return params.providerType
  }

  const modelName = params.modelName.trim().toLowerCase()
  const apiBaseUrl = params.apiBaseUrl?.trim().toLowerCase() ?? ''
  if (apiBaseUrl.includes('anthropic.com') || modelName.startsWith('claude')) return 'anthropic'
  if (apiBaseUrl.includes('generativelanguage.googleapis.com') || modelName.startsWith('gemini')) return 'gemini'
  if (apiBaseUrl.includes('aiplatform.googleapis.com')) return 'vertexai'
  if (apiBaseUrl.includes('moonshot') || apiBaseUrl.includes('api.kimi.com') || modelName.startsWith('kimi')) {
    return 'kimi'
  }
  return apiBaseUrl.includes('/responses') ? 'openai_responses' : 'openai_legacy'
}

const buildMoonshotServiceConfig = (baseUrl: string, apiKey: string, customHeaders: Record<string, string>) => {
  const normalizedBase = baseUrl.replace(/\/+$/u, '')
  const shared = {
    api_key: apiKey,
    ...(Object.keys(customHeaders).length > 0 ? { custom_headers: customHeaders } : {})
  }
  return {
    moonshot_search: {
      base_url: `${normalizedBase}/search`,
      ...shared
    },
    moonshot_fetch: {
      base_url: `${normalizedBase}/fetch`,
      ...shared
    }
  }
}

const resolveRealKimiShareDir = (env: AdapterCtx['env']) => {
  const explicit = env.__VF_PROJECT_AI_ADAPTER_KIMI_SHARE_DIR__?.trim() ??
    env.KIMI_SHARE_DIR?.trim() ??
    process.env.KIMI_SHARE_DIR?.trim()
  return explicit != null && explicit !== '' ? explicit : resolve(homedir(), '.kimi')
}

const resolveCopiedConfigPath = async (shareDir: string, realShareDir: string) => {
  const candidates = ['config.toml', 'config.json']
  for (const fileName of candidates) {
    const sourcePath = resolve(realShareDir, fileName)
    const targetPath = resolve(shareDir, fileName)
    if (!pathExists(sourcePath) || pathExists(targetPath)) continue
    await copyFile(sourcePath, targetPath)
    return targetPath
  }
  return candidates
    .map(fileName => resolve(shareDir, fileName))
    .find(targetPath => pathExists(targetPath))
}

const ensureCredentialsLink = async (shareDir: string, realShareDir: string) => {
  const sourcePath = resolve(realShareDir, 'credentials')
  const targetPath = resolve(shareDir, 'credentials')
  if (!pathExists(sourcePath) || pathExists(targetPath)) return

  try {
    await syncSymlinkTarget({
      sourcePath,
      targetPath,
      type: 'dir'
    })
  } catch {
    await cp(sourcePath, targetPath, { recursive: true })
  }
}

const resolveModelServiceExtra = (service: ModelServiceConfig) => ({
  ...asPlainRecord(asPlainRecord(service.extra)?.codex),
  ...asPlainRecord(asPlainRecord(service.extra)?.opencode),
  ...asPlainRecord(asPlainRecord(service.extra)?.kimi)
})

const buildGeneratedModelConfig = (params: {
  adapterConfig: KimiAdapterConfig
  env: AdapterCtx['env']
  modelServices: Record<string, ModelServiceConfig>
  rawModel?: string
}) => {
  const parsed = parseServiceModelSelector(params.rawModel)
  if (parsed == null) return undefined

  const service = params.modelServices[parsed.serviceKey]
  if (service == null) return undefined

  const extra = resolveModelServiceExtra(service)
  const providerType = inferProviderType({
    apiBaseUrl: service.apiBaseUrl,
    providerType: typeof extra.providerType === 'string' ? extra.providerType : undefined,
    modelName: parsed.modelName
  })
  const providerKey = typeof extra.providerId === 'string' && extra.providerId.trim() !== ''
    ? extra.providerId.trim()
    : parsed.serviceKey
  const modelKey = typeof extra.modelKey === 'string' && extra.modelKey.trim() !== ''
    ? extra.modelKey.trim()
    : `${parsed.serviceKey}__${parsed.modelName}`
  const customHeaders = normalizeStringRecord(extra.headers)
  const providerEnv = normalizeStringRecord(extra.env)
  const queryParams = normalizeStringRecord(extra.queryParams)
  const baseUrl = appendQueryParams(
    normalizeProviderBaseUrl(service.apiBaseUrl, providerType),
    queryParams
  )
  const capabilities = Array.from(
    new Set(
      Array.isArray(extra.capabilities)
        ? extra.capabilities.filter((item): item is string => typeof item === 'string')
        : parsed.modelName.includes('thinking')
        ? ['always_thinking']
        : []
    )
  )
  const generated = {
    default_model: modelKey,
    providers: {
      [providerKey]: {
        type: providerType,
        base_url: baseUrl,
        api_key: service.apiKey,
        ...(Object.keys(customHeaders).length > 0 ? { custom_headers: customHeaders } : {}),
        ...(Object.keys(providerEnv).length > 0 ? { env: providerEnv } : {})
      }
    },
    models: {
      [modelKey]: {
        provider: providerKey,
        model: parsed.modelName,
        max_context_size: normalizePositiveInteger(extra.maxContextSize) ?? DEFAULT_CONTEXT_SIZE,
        ...(capabilities.length > 0 ? { capabilities } : {})
      }
    }
  } satisfies Record<string, unknown>

  return providerType === 'kimi'
    ? {
      cliModel: modelKey,
      config: {
        ...generated,
        services: buildMoonshotServiceConfig(baseUrl, service.apiKey, customHeaders)
      }
    }
    : {
      cliModel: modelKey,
      config: generated
    }
}

const buildFallbackModelConfig = (params: {
  env: AdapterCtx['env']
  rawModel?: string
}) => {
  const normalizedModel = params.rawModel?.trim()
  if (normalizedModel == null || normalizedModel === '' || normalizedModel.toLowerCase() === 'default') {
    return undefined
  }

  const providerType = inferProviderType({
    apiBaseUrl: params.env.KIMI_BASE_URL ?? process.env.KIMI_BASE_URL,
    modelName: normalizedModel
  })
  const baseUrl = providerType === 'anthropic'
    ? 'https://api.anthropic.com'
    : providerType === 'gemini'
    ? 'https://generativelanguage.googleapis.com'
    : providerType === 'vertexai'
    ? 'https://aiplatform.googleapis.com'
    : providerType === 'kimi'
    ? 'https://api.kimi.com/coding/v1'
    : 'https://api.openai.com/v1'
  const apiKey = providerType === 'anthropic'
    ? (params.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? '')
    : providerType === 'gemini'
    ? (params.env.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY ?? '')
    : providerType === 'kimi'
    ? (params.env.KIMI_API_KEY ?? process.env.KIMI_API_KEY ?? '')
    : (params.env.OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? '')

  return {
    cliModel: normalizedModel,
    config: {
      default_model: normalizedModel,
      providers: {
        default: {
          type: providerType,
          base_url: baseUrl,
          api_key: apiKey
        }
      },
      models: {
        [normalizedModel]: {
          provider: 'default',
          model: normalizedModel,
          max_context_size: DEFAULT_CONTEXT_SIZE,
          ...(normalizedModel.includes('thinking') ? { capabilities: ['always_thinking'] } : {})
        }
      }
    } satisfies Record<string, unknown>
  }
}

const buildMcpConfig = (servers: Record<string, NonNullable<Config['mcpServers']>[string]>) => ({
  mcpServers: Object.fromEntries(
    Object.entries(servers).map(([name, server]) => {
      if ('command' in server) {
        return [name, {
          transport: 'stdio',
          command: server.command,
          args: server.args,
          ...(server.env != null ? { env: server.env } : {})
        }]
      }

      return [name, {
        transport: server.type === 'sse' ? 'sse' : 'http',
        url: server.url,
        ...(server.headers != null ? { headers: server.headers } : {})
      }]
    })
  )
})

const resolveKimiNativeHookState = (ctx: AdapterCtx) => {
  const command = ctx.env.__VF_PROJECT_AI_KIMI_HOOK_COMMAND__?.trim()
  return {
    enabled: ctx.env.__VF_PROJECT_AI_KIMI_NATIVE_HOOKS_AVAILABLE__ === '1' && command != null && command !== '',
    command: command ?? ''
  }
}

const mergeKimiNativeHooksIntoConfig = (
  config: Record<string, unknown>,
  state: ReturnType<typeof resolveKimiNativeHookState>
) =>
  mergeKimiNativeHooksIntoJsonConfig({
    config,
    enabled: state.enabled,
    command: state.command
  })

const applyKimiNativeHooksToCopiedConfig = async (
  copiedConfigPath: string | undefined,
  state: ReturnType<typeof resolveKimiNativeHookState>,
  logger: AdapterCtx['logger']
) => {
  if (copiedConfigPath == null) return

  try {
    if (copiedConfigPath.endsWith('.json')) {
      const existing = JSON.parse(await readFile(copiedConfigPath, 'utf8')) as unknown
      const merged = mergeKimiNativeHooksIntoJsonConfig({
        config: asPlainRecord(existing),
        enabled: state.enabled,
        command: state.command
      })
      await writeFile(copiedConfigPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
      return
    }

    if (copiedConfigPath.endsWith('.toml')) {
      const merged = mergeKimiNativeHooksIntoTomlConfig({
        content: await readFile(copiedConfigPath, 'utf8'),
        enabled: state.enabled,
        command: state.command
      })
      await writeFile(copiedConfigPath, merged, 'utf8')
    }
  } catch (error) {
    logger.warn('[kimi hooks] failed to merge native hooks into copied Kimi config', error)
  }
}

const stageSkillOverlays = async (sessionRoot: string, options: AdapterQueryOptions) => {
  const overlays = (options.assetPlan?.overlays ?? []).filter(overlay => overlay.kind === 'skill')
  if (overlays.length === 0) return undefined

  const skillsDir = resolve(sessionRoot, 'skills')
  await rm(skillsDir, { recursive: true, force: true })
  await mkdir(skillsDir, { recursive: true })

  for (const overlay of overlays) {
    const targetPath = resolve(skillsDir, overlay.targetPath)
    await mkdir(dirname(targetPath), { recursive: true })
    await syncSymlinkTarget({
      sourcePath: overlay.sourcePath,
      targetPath,
      type: 'dir'
    })
  }

  return skillsDir
}

export const hasStoredKimiSessionState = (shareDir: string) => pathExists(resolve(shareDir, 'sessions'))

export const resolveKimiSessionBase = async (
  ctx: AdapterCtx,
  options: AdapterQueryOptions
): Promise<KimiSessionBase> => {
  const adapterConfig = resolveAdapterConfig(ctx)
  const sessionRoot = resolve(ctx.cwd, '.ai', 'caches', ctx.ctxId, options.sessionId, 'adapter-kimi')
  const shareDir = resolve(sessionRoot, 'share')
  const realShareDir = resolveRealKimiShareDir(ctx.env)

  await mkdir(shareDir, { recursive: true })
  await ensureCredentialsLink(shareDir, realShareDir)

  const copiedConfigPath = await resolveCopiedConfigPath(shareDir, realShareDir)
  const nativeHookState = resolveKimiNativeHookState(ctx)
  const mergedModelServices = {
    ...(ctx.configs[0]?.modelServices ?? {}),
    ...(ctx.configs[1]?.modelServices ?? {})
  } as Record<string, ModelServiceConfig>
  const generatedModelConfig = buildGeneratedModelConfig({
    adapterConfig,
    env: ctx.env,
    modelServices: mergedModelServices,
    rawModel: options.model
  }) ?? (copiedConfigPath == null ? buildFallbackModelConfig({ env: ctx.env, rawModel: options.model }) : undefined)

  const baseGeneratedConfig = adapterConfig.configContent == null
    ? generatedModelConfig?.config
    : deepMerge(generatedModelConfig?.config ?? {}, adapterConfig.configContent)
  const generatedConfig = baseGeneratedConfig != null
    ? mergeKimiNativeHooksIntoConfig(baseGeneratedConfig, nativeHookState)
    : copiedConfigPath == null && nativeHookState.enabled
    ? mergeKimiNativeHooksIntoConfig({}, nativeHookState)
    : undefined

  const generatedConfigPath = generatedConfig == null
    ? undefined
    : resolve(shareDir, 'config.json')
  if (generatedConfigPath != null) {
    await writeFile(generatedConfigPath, `${JSON.stringify(generatedConfig, null, 2)}\n`, 'utf8')
  } else {
    await applyKimiNativeHooksToCopiedConfig(copiedConfigPath, nativeHookState, ctx.logger)
  }

  const selectedMcpServers = options.assetPlan?.mcpServers ?? {}
  const mcpConfigPath = Object.keys(selectedMcpServers).length === 0
    ? undefined
    : resolve(shareDir, 'mcp.json')
  if (mcpConfigPath != null) {
    await writeFile(mcpConfigPath, `${JSON.stringify(buildMcpConfig(selectedMcpServers), null, 2)}\n`, 'utf8')
  }

  const agentFileContent = buildKimiAgentFileContent({
    agent: adapterConfig.agent,
    systemPrompt: options.systemPrompt,
    tools: options.tools
  })
  const normalizedSystemPrompt = options.systemPrompt?.trim()
  const agentFilePath = agentFileContent == null ? undefined : resolve(sessionRoot, 'agent', 'agent.yaml')
  if (agentFilePath != null && agentFileContent != null) {
    await mkdir(dirname(agentFilePath), { recursive: true })
    await writeFile(agentFilePath, agentFileContent, 'utf8')
    if (normalizedSystemPrompt != null && normalizedSystemPrompt !== '') {
      await writeFile(resolve(dirname(agentFilePath), 'system.md'), `${normalizedSystemPrompt}\n`, 'utf8')
    }
  }

  const skillsDir = await stageSkillOverlays(sessionRoot, options)
  const thinking = resolveRequestedThinking(options.effort, adapterConfig)
  const turnArgPrefix = [
    '--work-dir',
    ctx.cwd,
    ...(generatedConfigPath != null ? ['--config-file', generatedConfigPath] : []),
    ...(mcpConfigPath != null ? ['--mcp-config-file', mcpConfigPath] : []),
    ...(skillsDir != null ? ['--skills-dir', skillsDir] : []),
    ...(agentFilePath != null
      ? ['--agent-file', agentFilePath]
      : typeof adapterConfig.agent === 'string' && adapterConfig.agent.trim() !== ''
      ? ['--agent', adapterConfig.agent.trim()]
      : []),
    ...(generatedModelConfig?.cliModel != null
      ? ['--model', generatedModelConfig.cliModel]
      : copiedConfigPath == null && options.model != null && options.model.trim() !== '' && options.model !== 'default'
      ? ['--model', options.model]
      : []),
    ...(thinking == null ? [] : [thinking ? '--thinking' : '--no-thinking']),
    ...(adapterConfig.maxStepsPerTurn != null ? ['--max-steps-per-turn', String(adapterConfig.maxStepsPerTurn)] : []),
    ...(adapterConfig.maxRetriesPerStep != null
      ? ['--max-retries-per-step', String(adapterConfig.maxRetriesPerStep)]
      : []),
    ...(adapterConfig.maxRalphIterations != null
      ? ['--max-ralph-iterations', String(adapterConfig.maxRalphIterations)]
      : []),
    ...(options.extraOptions ?? [])
  ]

  return {
    binaryPath: resolveKimiBinaryPath(ctx.env, ctx.cwd),
    cliModel: generatedModelConfig?.cliModel ?? options.model,
    copiedConfigPath,
    cwd: ctx.cwd,
    ...(mcpConfigPath != null ? { mcpConfigPath } : {}),
    ...(agentFilePath == null && typeof adapterConfig.agent === 'string' && adapterConfig.agent.trim() !== ''
      ? { reportedAgent: adapterConfig.agent.trim() }
      : agentFilePath != null && typeof adapterConfig.agent === 'string' && adapterConfig.agent.trim() !== ''
      ? { reportedAgent: adapterConfig.agent.trim() }
      : { reportedAgent: 'default' }),
    reportedModel: options.model,
    shareDir,
    ...(skillsDir != null ? { skillsDir } : {}),
    spawnEnv: toProcessEnv({
      ...process.env,
      ...ctx.env,
      KIMI_SHARE_DIR: shareDir,
      KIMI_CLI_NO_AUTO_UPDATE: ctx.env.KIMI_CLI_NO_AUTO_UPDATE ?? '1',
      __VF_KIMI_TASK_SESSION_ID__: options.sessionId,
      __VF_KIMI_HOOK_RUNTIME__: options.runtime,
      ...(options.model != null ? { __VF_KIMI_HOOK_MODEL__: options.model } : {})
    }),
    thinking,
    toolNames: resolveReportedToolNames(options.tools, adapterConfig.agent),
    turnArgPrefix
  }
}
