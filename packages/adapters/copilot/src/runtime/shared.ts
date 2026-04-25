import { mkdir, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'

import type {
  AdapterCtx,
  AdapterMessageContent,
  AdapterQueryOptions,
  ChatMessage,
  Config,
  ModelServiceConfig
} from '@vibe-forge/types'
import { omitAdapterCommonConfig, syncSymlinkTarget } from '@vibe-forge/utils'
import { createLogger } from '@vibe-forge/utils/create-logger'
import type { ManagedNpmCliConfig } from '@vibe-forge/utils/managed-npm-cli'
import { uuid } from '@vibe-forge/utils/uuid'

import type { CopilotAdapterConfigSchema } from '../config-schema'
import { mergeCopilotNativeHooksIntoSettings } from './native-hooks'
import { registerCopilotProviderProxyRoute } from './provider-proxy'

export type CopilotAdapterConfig = CopilotAdapterConfigSchema

type McpServerConfig = NonNullable<Config['mcpServers']>[string]

interface CopilotProviderExtra {
  type?: string
  bearerToken?: string
  wireApi?: string
  azureApiVersion?: string
  modelId?: string
  wireModel?: string
  maxPromptTokens?: number
  maxOutputTokens?: number
  offline?: boolean
  queryParams?: Record<string, string>
  headers?: Record<string, string>
}

interface CopilotResolvedModelConfig {
  cliModel?: string
  providerEnv: Record<string, string>
  routedServiceKey?: string
  service?: ModelServiceConfig
  extra?: CopilotProviderExtra
}

export interface CopilotRunResult {
  exitCode: number
  stdout: string
  stderr: string
}

export const DEFAULT_COPILOT_TOOLS = [
  'read',
  'write',
  'shell',
  'mcp',
  'url'
]

export const resolveAdapterConfig = (ctx: AdapterCtx): CopilotAdapterConfig => {
  const [config, userConfig] = ctx.configs
  const projectConfig = (config?.adapters?.copilot ?? {}) as CopilotAdapterConfig
  const userAdapterConfig = (userConfig?.adapters?.copilot ?? {}) as CopilotAdapterConfig
  return omitAdapterCommonConfig({
    ...projectConfig,
    ...userAdapterConfig,
    ...(projectConfig.cli != null || userAdapterConfig.cli != null
      ? {
        cli: deepMerge(
          (projectConfig.cli ?? {}) as Record<string, unknown>,
          (userAdapterConfig.cli ?? {}) as Record<string, unknown>
        ) as ManagedNpmCliConfig
      }
      : {}),
    ...(projectConfig.configContent != null || userAdapterConfig.configContent != null
      ? { configContent: deepMerge(projectConfig.configContent ?? {}, userAdapterConfig.configContent ?? {}) }
      : {})
  }) as CopilotAdapterConfig
}

export const toProcessEnv = (env: AdapterCtx['env']): NodeJS.ProcessEnv => ({
  ...process.env,
  ...Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  )
})

const joinEnvList = (...values: Array<string | undefined>) => (
  values
    .flatMap(value => value?.split(',') ?? [])
    .map(value => value.trim())
    .filter(Boolean)
    .join(',')
)

const asPlainObject = (value: unknown): Record<string, unknown> | undefined => (
  value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
)

const deepMerge = (base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> => {
  const result: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(override)) {
    const baseRecord = asPlainObject(result[key])
    const valueRecord = asPlainObject(value)
    result[key] = baseRecord != null && valueRecord != null
      ? deepMerge(baseRecord, valueRecord)
      : value
  }
  return result
}

const asString = (value: unknown) => typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined

const asStringList = (value: unknown) => (
  Array.isArray(value)
    ? value
      .filter((entry): entry is string => typeof entry === 'string')
      .map(entry => entry.trim())
      .filter(Boolean)
    : []
)

const asPositiveIntegerString = (value: unknown) => (
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? String(Math.floor(value))
    : undefined
)

const normalizeStringRecord = (value: unknown): Record<string, string> => {
  const record = asPlainObject(value)
  if (record == null) return {}
  return Object.fromEntries(
    Object.entries(record).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  )
}

const normalizeCopilotProviderBaseUrl = (apiBaseUrl: string | undefined, wireApi: string | undefined) => {
  if (typeof apiBaseUrl !== 'string' || apiBaseUrl.trim() === '') return undefined
  const normalizedBaseUrl = apiBaseUrl.trim()
  if ((wireApi ?? '').trim() === 'responses' || normalizedBaseUrl.endsWith('/responses')) {
    return normalizedBaseUrl.replace(/\/responses\/?$/u, '')
  }
  return normalizedBaseUrl.replace(/\/chat\/completions\/?$/u, '')
}

const resolveMergedModelServices = (ctx: AdapterCtx) =>
  ({
    ...(ctx.configs[0]?.modelServices ?? {}),
    ...(ctx.configs[1]?.modelServices ?? {})
  }) as Record<string, ModelServiceConfig>

export const resolveCopilotModelConfig = (
  ctx: AdapterCtx,
  rawModel: string | undefined
): CopilotResolvedModelConfig => {
  const normalizedRawModel = rawModel?.trim()
  if (normalizedRawModel == null || normalizedRawModel === '' || normalizedRawModel === 'default') {
    return {
      cliModel: undefined,
      providerEnv: {}
    }
  }

  if (!normalizedRawModel.includes(',')) {
    return {
      cliModel: normalizedRawModel,
      providerEnv: {}
    }
  }

  const commaIdx = normalizedRawModel.indexOf(',')
  const serviceKey = normalizedRawModel.slice(0, commaIdx).trim()
  const modelId = normalizedRawModel.slice(commaIdx + 1).trim()
  const service = resolveMergedModelServices(ctx)[serviceKey]
  const extra = asPlainObject(service?.extra?.copilot) as CopilotProviderExtra | undefined
  if (service == null) {
    return {
      cliModel: modelId || undefined,
      providerEnv: {}
    }
  }

  const wireApi = asString(extra?.wireApi)
  const providerBaseUrl = normalizeCopilotProviderBaseUrl(service.apiBaseUrl, wireApi)
  const maxPromptTokens = asPositiveIntegerString(extra?.maxPromptTokens)
  const maxOutputTokens = asPositiveIntegerString(extra?.maxOutputTokens ?? service.maxOutputTokens)
  return {
    cliModel: modelId || undefined,
    providerEnv: {
      ...(providerBaseUrl != null ? { COPILOT_PROVIDER_BASE_URL: providerBaseUrl } : {}),
      ...(service.apiKey ? { COPILOT_PROVIDER_API_KEY: service.apiKey } : {}),
      COPILOT_PROVIDER_TYPE: asString(extra?.type) ?? 'openai',
      COPILOT_PROVIDER_MODEL_ID: asString(extra?.modelId) ?? modelId,
      COPILOT_PROVIDER_WIRE_MODEL: asString(extra?.wireModel) ?? modelId,
      ...(asString(extra?.bearerToken) != null
        ? { COPILOT_PROVIDER_BEARER_TOKEN: asString(extra?.bearerToken)! }
        : {}),
      ...(wireApi != null ? { COPILOT_PROVIDER_WIRE_API: wireApi } : {}),
      ...(asString(extra?.azureApiVersion) != null
        ? { COPILOT_PROVIDER_AZURE_API_VERSION: asString(extra?.azureApiVersion)! }
        : {}),
      ...(maxPromptTokens != null ? { COPILOT_PROVIDER_MAX_PROMPT_TOKENS: maxPromptTokens } : {}),
      ...(maxOutputTokens != null ? { COPILOT_PROVIDER_MAX_OUTPUT_TOKENS: maxOutputTokens } : {}),
      ...(extra?.offline === true ? { COPILOT_OFFLINE: 'true' } : {})
    },
    routedServiceKey: serviceKey,
    service,
    extra
  }
}

const buildCopilotProviderEnv = async (
  ctx: AdapterCtx,
  options: AdapterQueryOptions,
  modelConfig: ReturnType<typeof resolveCopilotModelConfig>
) => {
  if (modelConfig.service == null || modelConfig.routedServiceKey == null) {
    return modelConfig.providerEnv
  }

  const upstreamBaseUrl = modelConfig.providerEnv.COPILOT_PROVIDER_BASE_URL?.trim()
  if (!upstreamBaseUrl) return modelConfig.providerEnv

  const proxyLogger = createLogger(
    ctx.cwd,
    `${ctx.ctxId}/${options.sessionId}/adapter-copilot`,
    'provider-proxy'
  )
  const route = await registerCopilotProviderProxyRoute({
    upstreamBaseUrl,
    queryParams: normalizeStringRecord(modelConfig.extra?.queryParams),
    headers: normalizeStringRecord(modelConfig.extra?.headers),
    logContext: {
      cwd: ctx.cwd,
      ctxId: ctx.ctxId,
      sessionId: options.sessionId
    },
    diagnostics: {
      routedServiceKey: modelConfig.routedServiceKey,
      requestedModel: options.model,
      resolvedModel: modelConfig.cliModel,
      runtime: options.runtime,
      sessionType: options.type,
      permissionMode: options.permissionMode,
      requestedEffort: options.effort,
      providerType: modelConfig.providerEnv.COPILOT_PROVIDER_TYPE
    }
  }, proxyLogger)

  proxyLogger.info('[copilot provider proxy] routed model service registered', {
    routeId: route.routeId,
    routedServiceKey: modelConfig.routedServiceKey,
    requestedModel: options.model,
    resolvedModel: modelConfig.cliModel,
    upstreamBaseUrl,
    proxyBaseUrl: route.baseUrl
  })

  return {
    ...modelConfig.providerEnv,
    COPILOT_PROVIDER_BASE_URL: route.baseUrl
  }
}

export const createAssistantMessage = (content: string, model?: string): ChatMessage => ({
  id: uuid(),
  role: 'assistant',
  content,
  createdAt: Date.now(),
  ...(model != null ? { model } : {})
})

export const getErrorMessage = (error: unknown) => (
  error instanceof Error ? error.message : String(error ?? 'Copilot session failed unexpectedly')
)

export const toAdapterErrorData = (
  error: unknown,
  overrides: Partial<{ message: string; code: string; details: unknown; fatal: boolean }> = {}
) => ({
  message: overrides.message ?? getErrorMessage(error),
  ...(overrides.code != null ? { code: overrides.code } : {}),
  ...(overrides.details !== undefined ? { details: overrides.details } : {}),
  fatal: overrides.fatal ?? true
})

const normalizeText = (value: string) => value.trim()

export const normalizeCopilotPrompt = (content: AdapterMessageContent[]): string => {
  const parts: string[] = []

  for (const item of content) {
    if (item.type === 'text') {
      const text = normalizeText(item.text)
      if (text !== '') parts.push(text)
      continue
    }

    if (item.type === 'file') {
      parts.push(`Context file: ${item.path}`)
      continue
    }

    if (item.type === 'image') {
      parts.push(`Context image: ${item.url}`)
    }
  }

  return parts.join('\n\n').trim()
}

const mapEffortToCopilot = (effort: AdapterQueryOptions['effort']) => (
  effort === 'max'
    ? 'xhigh'
    : effort === 'low' || effort === 'medium' || effort === 'high'
    ? effort
    : undefined
)

const pushStringListArg = (args: string[], flag: string, values: string[] | undefined) => {
  const normalized = values?.map(value => value.trim()).filter(Boolean)
  if (normalized == null || normalized.length === 0) return
  for (const value of normalized) {
    args.push(flag, value)
  }
}

const mapMcpServerForCopilot = (server: McpServerConfig) => {
  if (server.type === 'http' || server.type === 'sse') {
    return {
      type: server.type,
      url: server.url,
      tools: ['*'],
      ...(server.headers != null ? { headers: server.headers } : {}),
      ...(server.env != null ? { env: server.env } : {})
    }
  }

  return {
    type: 'local',
    command: server.command,
    args: server.args,
    tools: ['*'],
    ...(server.env != null ? { env: server.env } : {})
  }
}

const buildAdditionalMcpConfig = (options: AdapterQueryOptions) => {
  const mcpServers = options.assetPlan?.mcpServers
  if (mcpServers == null || Object.keys(mcpServers).length === 0) return undefined

  return JSON.stringify({
    mcpServers: Object.fromEntries(
      Object.entries(mcpServers).map(([name, server]) => [name, mapMcpServerForCopilot(server)])
    )
  })
}

const resolveConfigDir = (ctx: AdapterCtx, adapterConfig: CopilotAdapterConfig) => (
  adapterConfig.configDir?.trim() || resolve(ctx.cwd, '.ai', '.mock', 'copilot')
)

export const ensureCopilotConfigDir = async (ctx: AdapterCtx, adapterConfig: CopilotAdapterConfig) => {
  const configDir = resolveConfigDir(ctx, adapterConfig)
  await mkdir(configDir, { recursive: true })
  return configDir
}

const readCopilotSettings = async (
  ctx: AdapterCtx,
  configDir: string
) => {
  const settingsPath = resolve(configDir, 'settings.json')
  const legacyConfigPath = resolve(configDir, 'config.json')
  let rawContent = ''
  let rawConfig: Record<string, unknown> = {}
  let loadedLegacyConfig = false

  try {
    rawContent = await readFile(settingsPath, 'utf8')
    rawConfig = asPlainObject(JSON.parse(rawContent)) ?? {}
  } catch (error) {
    const code = typeof error === 'object' && error != null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : undefined
    if (code !== 'ENOENT') {
      ctx.logger.warn('Failed to read existing Copilot settings; rewriting managed settings', {
        err: error
      })
    }
    if (code === 'ENOENT') {
      try {
        rawContent = ''
        rawConfig = asPlainObject(JSON.parse(await readFile(legacyConfigPath, 'utf8'))) ?? {}
        loadedLegacyConfig = true
      } catch (legacyError) {
        const legacyCode = typeof legacyError === 'object' && legacyError != null && 'code' in legacyError
          ? String((legacyError as { code?: unknown }).code)
          : undefined
        if (legacyCode !== 'ENOENT') {
          ctx.logger.warn('Failed to read legacy Copilot config; rewriting managed settings', {
            err: legacyError
          })
        }
      }
    }
  }

  return {
    legacyConfigPath,
    loadedLegacyConfig,
    rawContent,
    rawConfig,
    settingsPath
  }
}

export const ensureCopilotRuntimeSettings = async (
  ctx: AdapterCtx,
  options: AdapterQueryOptions,
  adapterConfig: CopilotAdapterConfig,
  configDir: string
) => {
  const { legacyConfigPath, loadedLegacyConfig, rawContent, rawConfig, settingsPath } = await readCopilotSettings(
    ctx,
    configDir
  )
  const explicitConfig = asPlainObject(adapterConfig.configContent)
  let nextConfig = explicitConfig != null ? deepMerge(rawConfig, explicitConfig) : { ...rawConfig }

  if (adapterConfig.disableWorkspaceTrust !== true) {
    const trustedFolders = Array.from(
      new Set([
        ...asStringList(nextConfig.trusted_folders),
        ...asStringList(nextConfig.trustedFolders),
        ctx.cwd
      ])
    )
    nextConfig = {
      ...nextConfig,
      trusted_folders: trustedFolders
    }
    delete nextConfig.trustedFolders
  }

  nextConfig = mergeCopilotNativeHooksIntoSettings({
    settings: nextConfig,
    ctx,
    options
  })

  if (Object.keys(nextConfig).length === 0 && rawContent === '') return
  const nextContent = `${JSON.stringify(nextConfig, null, 2)}\n`
  if (rawContent === nextContent) return
  await writeFile(settingsPath, nextContent, 'utf8')
  if (loadedLegacyConfig) {
    await unlink(legacyConfigPath).catch(() => undefined)
  }
}

export const ensureCopilotSessionMarker = async (ctx: AdapterCtx, sessionId: string) => {
  await ctx.cache.set('adapter.copilot.session', {
    copilotSessionId: sessionId,
    title: `Vibe Forge:${sessionId}`
  })
}

const ensureSymlinkTarget = async (sourcePath: string, targetPath: string) => {
  await syncSymlinkTarget({
    sourcePath,
    targetPath
  })
}

export const syncCopilotManagedSymlink = async (params: {
  sourcePath: string
  targetPath: string
  type: 'dir' | 'file'
}) => {
  await syncSymlinkTarget({
    ...params,
    onMissingSource: 'remove'
  })
}

const stripSkillTargetPrefix = (targetPath: string) => (
  targetPath.startsWith('skills/') ? targetPath.slice('skills/'.length) : targetPath
)

const ensureCopilotSkillDir = async (ctx: AdapterCtx, options: AdapterQueryOptions) => {
  const skillOverlays = options.assetPlan?.overlays.filter(entry => entry.kind === 'skill') ?? []
  if (skillOverlays.length === 0) return undefined

  const skillsDir = resolve(ctx.cwd, '.ai', '.mock', 'copilot', 'sessions', options.sessionId, 'skills')
  await rm(skillsDir, { recursive: true, force: true })
  await mkdir(skillsDir, { recursive: true })

  for (const overlay of skillOverlays) {
    await ensureSymlinkTarget(
      overlay.sourcePath,
      resolve(skillsDir, stripSkillTargetPrefix(overlay.targetPath))
    )
  }

  return skillsDir
}

const ensureCopilotInstructionsDir = async (
  ctx: AdapterCtx,
  options: AdapterQueryOptions,
  adapterConfig: CopilotAdapterConfig
) => {
  const systemPrompt = options.systemPrompt?.trim()
  if (systemPrompt == null || systemPrompt === '' || adapterConfig.noCustomInstructions === true) {
    return undefined
  }

  const instructionsDir = resolve(
    ctx.cwd,
    '.ai',
    '.mock',
    'copilot',
    'sessions',
    options.sessionId,
    'instructions'
  )
  await mkdir(instructionsDir, { recursive: true })
  await writeFile(resolve(instructionsDir, 'copilot-instructions.md'), `${systemPrompt}\n`, 'utf8')
  return instructionsDir
}

export const buildCopilotChildEnv = async (
  ctx: AdapterCtx,
  options: AdapterQueryOptions,
  adapterConfig: CopilotAdapterConfig
) => {
  const configDir = await ensureCopilotConfigDir(ctx, adapterConfig)
  await ensureCopilotRuntimeSettings(ctx, options, adapterConfig, configDir)
  const skillsDir = await ensureCopilotSkillDir(ctx, options)
  const instructionsDir = await ensureCopilotInstructionsDir(ctx, options, adapterConfig)
  const modelConfig = resolveCopilotModelConfig(ctx, options.model)
  const providerEnv = await buildCopilotProviderEnv(ctx, options, modelConfig)
  const existingSkillDirs = typeof ctx.env.COPILOT_SKILLS_DIRS === 'string'
    ? ctx.env.COPILOT_SKILLS_DIRS
    : process.env.COPILOT_SKILLS_DIRS
  const existingInstructionDirs = typeof ctx.env.COPILOT_CUSTOM_INSTRUCTIONS_DIRS === 'string'
    ? ctx.env.COPILOT_CUSTOM_INSTRUCTIONS_DIRS
    : process.env.COPILOT_CUSTOM_INSTRUCTIONS_DIRS
  const existingAgentDirs = typeof ctx.env.COPILOT_AGENT_DIRS === 'string'
    ? ctx.env.COPILOT_AGENT_DIRS
    : process.env.COPILOT_AGENT_DIRS
  const configuredAgentDirs = adapterConfig.agentDirs?.map(value => value.trim()).filter(Boolean).join(',')
  const configuredAdditionalInstructions = adapterConfig.additionalInstructions?.trim()
  const existingAdditionalInstructions = typeof ctx.env.COPILOT_ADDITIONAL_CUSTOM_INSTRUCTIONS === 'string'
    ? ctx.env.COPILOT_ADDITIONAL_CUSTOM_INSTRUCTIONS
    : process.env.COPILOT_ADDITIONAL_CUSTOM_INSTRUCTIONS
  const additionalInstructions = [
    existingAdditionalInstructions,
    configuredAdditionalInstructions
  ].filter((value): value is string => value != null && value.trim() !== '').join('\n\n')
  const nativeHooksActive = ctx.env.__VF_PROJECT_AI_COPILOT_NATIVE_HOOKS_AVAILABLE__ === '1'

  return toProcessEnv({
    ...ctx.env,
    ...providerEnv,
    COPILOT_HOME: typeof ctx.env.COPILOT_HOME === 'string' && ctx.env.COPILOT_HOME.trim() !== ''
      ? ctx.env.COPILOT_HOME
      : configDir,
    COPILOT_AUTO_UPDATE: typeof ctx.env.COPILOT_AUTO_UPDATE === 'string'
      ? ctx.env.COPILOT_AUTO_UPDATE
      : 'false',
    ...(skillsDir != null
      ? { COPILOT_SKILLS_DIRS: joinEnvList(existingSkillDirs, skillsDir) }
      : {}),
    ...(instructionsDir != null
      ? { COPILOT_CUSTOM_INSTRUCTIONS_DIRS: joinEnvList(existingInstructionDirs, instructionsDir) }
      : {}),
    ...(configuredAgentDirs != null && configuredAgentDirs !== ''
      ? { COPILOT_AGENT_DIRS: joinEnvList(existingAgentDirs, configuredAgentDirs) }
      : {}),
    ...(additionalInstructions !== ''
      ? { COPILOT_ADDITIONAL_CUSTOM_INSTRUCTIONS: additionalInstructions }
      : {}),
    ...(nativeHooksActive
      ? { __VF_VIBE_FORGE_COPILOT_HOOKS_ACTIVE__: '1' }
      : {})
  })
}

const buildPermissionArgs = (
  options: AdapterQueryOptions,
  adapterConfig: CopilotAdapterConfig,
  hasModeFlag: boolean
) => {
  const args: string[] = []
  const allowAll = adapterConfig.allowAll === true || options.permissionMode === 'bypassPermissions'
  if (allowAll) {
    args.push('--allow-all')
    return args
  }

  if (adapterConfig.allowAllTools === true) args.push('--allow-all-tools')
  if (adapterConfig.allowAllPaths === true || options.permissionMode === 'acceptEdits') args.push('--allow-all-paths')
  if (adapterConfig.allowAllUrls === true) args.push('--allow-all-urls')
  pushStringListArg(args, '--allow-tool', adapterConfig.allowTools)
  pushStringListArg(args, '--deny-tool', adapterConfig.denyTools)
  pushStringListArg(args, '--allow-url', adapterConfig.allowUrls)
  pushStringListArg(args, '--deny-url', adapterConfig.denyUrls)
  if (adapterConfig.noAskUser === true || options.permissionMode === 'dontAsk') args.push('--no-ask-user')
  if (options.permissionMode === 'plan' && !hasModeFlag) args.push('--plan')

  return args
}

export const buildCopilotBaseArgs = async (params: {
  ctx: AdapterCtx
  options: AdapterQueryOptions
  adapterConfig: CopilotAdapterConfig
  prompt?: string
  interactive?: boolean
  outputFormat?: 'json'
}) => {
  const { ctx, options, adapterConfig, prompt, interactive, outputFormat } = params
  const args: string[] = [
    '--resume',
    options.sessionId,
    '--no-auto-update',
    adapterConfig.remote === true ? '--remote' : '--no-remote',
    '--config-dir',
    await ensureCopilotConfigDir(ctx, adapterConfig)
  ]

  if (adapterConfig.logDir != null && adapterConfig.logDir.trim() !== '') {
    args.push('--log-dir', adapterConfig.logDir)
  }
  if (adapterConfig.logLevel != null) {
    args.push('--log-level', adapterConfig.logLevel)
  }

  const model = resolveCopilotModelConfig(ctx, options.model).cliModel
  if (model != null) args.push('--model', model)

  const effort = mapEffortToCopilot(options.effort)
  if (effort != null) args.push('--effort', effort)

  const agent = adapterConfig.agent?.trim()
  if (agent) args.push('--agent', agent)

  pushStringListArg(args, '--plugin-dir', adapterConfig.pluginDirs)
  pushStringListArg(args, '--add-dir', adapterConfig.additionalDirs)
  const mode = adapterConfig.mode?.trim()
  if (mode) args.push('--mode', mode)
  if (adapterConfig.autopilot === true && !mode && options.permissionMode !== 'plan') args.push('--autopilot')
  const maxAutopilotContinues = asPositiveIntegerString(adapterConfig.maxAutopilotContinues)
  if (maxAutopilotContinues != null) args.push('--max-autopilot-continues', maxAutopilotContinues)
  if (adapterConfig.noColor === true) args.push('--no-color')
  if (adapterConfig.noBanner === true) args.push('--no-banner')
  if (adapterConfig.debug === true) args.push('--debug')
  if (adapterConfig.experimental === true) args.push('--experimental')
  if (adapterConfig.enableReasoningSummaries === true) args.push('--enable-reasoning-summaries')

  if (adapterConfig.noCustomInstructions === true) args.push('--no-custom-instructions')
  if (adapterConfig.disableBuiltinMcps === true) args.push('--disable-builtin-mcps')
  pushStringListArg(args, '--disable-mcp-server', adapterConfig.disabledMcpServers)
  if (adapterConfig.enableAllGithubMcpTools === true) args.push('--enable-all-github-mcp-tools')
  pushStringListArg(args, '--add-github-mcp-toolset', adapterConfig.additionalGithubMcpToolsets)
  pushStringListArg(args, '--add-github-mcp-tool', adapterConfig.additionalGithubMcpTools)
  pushStringListArg(args, '--available-tools', options.tools?.include)
  pushStringListArg(args, '--excluded-tools', options.tools?.exclude)

  const mcpConfig = buildAdditionalMcpConfig(options)
  if (mcpConfig != null) {
    args.push('--additional-mcp-config', mcpConfig)
  }

  args.push(...buildPermissionArgs(options, adapterConfig, Boolean(mode)))

  if (interactive) {
    if (prompt != null && prompt.trim() !== '') args.push('--interactive', prompt.trim())
  } else if (prompt != null) {
    args.push('--prompt', prompt)
  }

  if (outputFormat != null) {
    args.push('--output-format', outputFormat)
  }

  if (!interactive) {
    args.push('--stream', adapterConfig.stream === false ? 'off' : 'on')
  }

  args.push(...(options.extraOptions ?? []))

  return args
}
