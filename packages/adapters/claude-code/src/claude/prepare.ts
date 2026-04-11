import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import process from 'node:process'

import { NATIVE_HOOK_BRIDGE_ADAPTER_ENV } from '@vibe-forge/hooks'
import type { AdapterCtx, AdapterQueryOptions } from '@vibe-forge/types'
import { buildNativeModelCatalog, resolveBuiltinPassthroughRoutes, resolveServiceRoutes } from '@vibe-forge/utils'
import type { NativeModelCatalog } from '@vibe-forge/utils'

import { ensureClaudeCodeRouterReady } from '../ccr/daemon'
import { resolveClaudeCliPath } from '../ccr/paths'
import { builtinModels } from '../models'
import { stageClaudePluginDirs } from './plugins'

interface ClaudeExecutionSettings {
  [key: string]: unknown
  mcpServers: Record<string, unknown>
  permissions: {
    allow: string[]
    deny: string[]
    ask: string[]
    defaultMode?: AdapterQueryOptions['permissionMode']
  }
  defaultIncludeMcpServers: string[]
  defaultExcludeMcpServers: string[]
  plansDirectory: string
  env: Record<string, string | null | undefined>
  companyAnnouncements: string[]
}

interface PreparedClaudeExecution {
  cliPath: string
  args: string[]
  env: Record<string, string | null | undefined>
  cwd: string
  sessionId: string
  effort?: AdapterQueryOptions['effort']
  executionType: 'create' | 'resume'
  nativeCatalog?: NativeModelCatalog
  modelFallback?: string
}

const resolveCCRRequestLogContextPath = (cwd: string, sessionId: string) =>
  join(
    cwd,
    '.ai',
    '.mock',
    '.claude-code-router',
    'request-log-context',
    `${sessionId}.json`
  )

const persistCCRRequestLogContext = async (params: {
  cwd: string
  ctxId: string
  sessionId: string
}) => {
  const filePath = resolveCCRRequestLogContextPath(params.cwd, params.sessionId)
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(
    filePath,
    JSON.stringify({
      ctxId: params.ctxId,
      sessionId: params.sessionId
    }),
    'utf8'
  )
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === 'object' && !Array.isArray(value)

const deepMerge = (
  base: Record<string, unknown>,
  override: Record<string, unknown>
): Record<string, unknown> => {
  const merged: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(override)) {
    if (isPlainObject(value) && isPlainObject(merged[key])) {
      merged[key] = deepMerge(merged[key] as Record<string, unknown>, value)
      continue
    }
    merged[key] = value
  }
  return merged
}

const normalizeEffort = (value: unknown): AdapterQueryOptions['effort'] => (
  value === 'low' || value === 'medium' || value === 'high' || value === 'max'
    ? value
    : undefined
)

const asNonEmptyString = (value: unknown) => (
  typeof value === 'string' && value.trim() !== ''
    ? value
    : undefined
)

const uniqueStrings = (values: string[]) => [...new Set(values)]

const ANTHROPIC_BUILTIN_BASE_URL = 'https://api.anthropic.com'

const resolveClaudeBuiltinUpstream = (builtinValue: string) => {
  if (builtinValue === 'default' || builtinValue === 'opusplan') return undefined
  return {
    upstreamBaseUrl: ANTHROPIC_BUILTIN_BASE_URL,
    upstreamModel: builtinValue
  }
}

const buildClaudeNativeCatalog = (
  configs: [import('@vibe-forge/types').Config?, import('@vibe-forge/types').Config?],
  _adapterConfig: Record<string, unknown>
): NativeModelCatalog | undefined => {
  const [config, userConfig] = configs
  const mergedModelServices = {
    ...(config?.modelServices ?? {}),
    ...(userConfig?.modelServices ?? {})
  }
  const mergedModels = {
    ...(config?.models ?? {}),
    ...(userConfig?.models ?? {})
  }

  const builtinRoutes = resolveBuiltinPassthroughRoutes({
    builtinModels,
    resolveUpstream: resolveClaudeBuiltinUpstream,
    models: mergedModels,
    baseOrder: 0
  })

  const serviceRoutes = resolveServiceRoutes({
    modelServices: mergedModelServices,
    models: mergedModels,
    recommendedModels: [
      ...(config?.recommendedModels ?? []),
      ...(userConfig?.recommendedModels ?? [])
    ],
    nativeIdStrategy: 'selector',
    baseOrder: builtinModels.length,
    resolveServiceMeta: (_serviceKey, service) => {
      const extra = (service.extra ?? {}) as {
        claudeCodeRouter?: { queryParams?: Record<string, string> }
        codex?: { queryParams?: Record<string, string> }
      }
      const queryParams = extra.claudeCodeRouter?.queryParams ?? extra.codex?.queryParams
      if (queryParams == null || Object.keys(queryParams).length === 0) return undefined
      return { queryParams }
    }
  })

  if (builtinRoutes.length === 0 && serviceRoutes.length === 0) return undefined

  const defaultSelector = userConfig?.defaultModel ?? config?.defaultModel
  return buildNativeModelCatalog({ builtinRoutes, serviceRoutes, defaultSelector })
}

const resolveClaudeCustomModelOption = (params: {
  nativeCatalog?: NativeModelCatalog
  effectiveModel?: string
}) => {
  const { nativeCatalog, effectiveModel } = params
  if (nativeCatalog == null) return undefined

  const serviceRoutes = nativeCatalog.routes.filter(route => route.kind === 'service')
  if (serviceRoutes.length === 0) return undefined

  if (effectiveModel != null && effectiveModel !== '') {
    const currentRoute = serviceRoutes.find(route => route.selectorValue === effectiveModel)
    if (currentRoute != null) return currentRoute
  }

  if (nativeCatalog.defaultRoute?.kind === 'service') {
    return nativeCatalog.defaultRoute
  }

  return serviceRoutes[0]
}

export const prepareClaudeExecution = async (
  ctx: AdapterCtx,
  options: AdapterQueryOptions
): Promise<PreparedClaudeExecution> => {
  const { env, cwd, cache, configs: [config, userConfig] } = ctx
  const assetPlan = options.assetPlan
  const nativeHooksAvailable = env.__VF_PROJECT_AI_CLAUDE_NATIVE_HOOKS_AVAILABLE__ === '1'
  const {
    effort,
    description,
    sessionId,
    model,
    type,
    systemPrompt,
    appendSystemPrompt = true,
    permissionMode,
    mcpServers: inputMCPServersRule,
    tools: inputToolsRule
  } = options
  const resumeState = await cache.get('adapter.claude-code.resume-state')
  const executionType = type === 'resume' && resumeState?.canResume === true ? 'resume' : 'create'
  const mergedAdapterConfig = {
    ...(config?.adapters?.['claude-code'] ?? {}),
    ...(userConfig?.adapters?.['claude-code'] ?? {})
  } as {
    effort?: AdapterQueryOptions['effort']
    settingsContent?: Record<string, unknown>
    nativeEnv?: Record<string, string>
    nativeModelSwitch?: boolean
    nativeModelSwitchBootstrap?: boolean
  }
  const requestedEffort = effort ?? mergedAdapterConfig.effort
  const settingsContent = isPlainObject(mergedAdapterConfig.settingsContent)
    ? mergedAdapterConfig.settingsContent
    : {}
  const nativeEnv = isPlainObject(mergedAdapterConfig.nativeEnv)
    ? Object.fromEntries(
      Object.entries(mergedAdapterConfig.nativeEnv).filter((entry): entry is [string, string] =>
        typeof entry[1] === 'string'
      )
    )
    : {}
  const nativeEnvEffort = normalizeEffort(nativeEnv.CLAUDE_CODE_EFFORT_LEVEL)
  const settingsContentEffort = normalizeEffort(settingsContent.effortLevel)

  let settings: ClaudeExecutionSettings = {
    mcpServers: assetPlan?.mcpServers ?? {
      ...config?.mcpServers,
      ...userConfig?.mcpServers
    },
    permissions: {
      allow: [
        ...(config?.permissions?.allow ?? []),
        ...(userConfig?.permissions?.allow ?? [])
      ],
      deny: [
        ...(config?.permissions?.deny ?? []),
        ...(userConfig?.permissions?.deny ?? [])
      ],
      ask: [
        ...(config?.permissions?.ask ?? []),
        ...(userConfig?.permissions?.ask ?? [])
      ],
      defaultMode: permissionMode ??
        userConfig?.permissions?.defaultMode ??
        config?.permissions?.defaultMode
    },
    defaultIncludeMcpServers: [
      ...(config?.defaultIncludeMcpServers ?? []),
      ...(userConfig?.defaultIncludeMcpServers ?? [])
    ],
    defaultExcludeMcpServers: [
      ...(config?.defaultExcludeMcpServers ?? []),
      ...(userConfig?.defaultExcludeMcpServers ?? [])
    ],
    plansDirectory: './.ai/works',
    env: {
      ...(config?.env ?? {}),
      ...(userConfig?.env ?? {}),
      ...(nativeHooksAvailable
        ? {
          __VF_VIBE_FORGE_CLAUDE_HOOKS_ACTIVE__: '1',
          [NATIVE_HOOK_BRIDGE_ADAPTER_ENV]: 'claude-code',
          __VF_CLAUDE_HOOK_RUNTIME__: options.runtime,
          __VF_CLAUDE_TASK_SESSION_ID__: sessionId
        }
        : {})
    } as Record<string, string | null | undefined>,
    companyAnnouncements: [
      ...(config?.announcements ?? []),
      ...(userConfig?.announcements ?? [])
    ]
  }
  if (
    nativeEnvEffort == null &&
    settingsContentEffort == null &&
    (requestedEffort === 'low' || requestedEffort === 'medium' || requestedEffort === 'high')
  ) {
    settings = {
      ...settings,
      effortLevel: requestedEffort
    }
  }
  settings = deepMerge(settings, settingsContent) as ClaudeExecutionSettings
  const anthropicApiKey = asNonEmptyString(nativeEnv.ANTHROPIC_API_KEY) ??
    asNonEmptyString(settings.env.ANTHROPIC_API_KEY) ??
    asNonEmptyString(env.ANTHROPIC_API_KEY) ??
    asNonEmptyString(process.env.ANTHROPIC_API_KEY)
  const nativeBootstrapRequested = mergedAdapterConfig.nativeModelSwitch === true &&
    mergedAdapterConfig.nativeModelSwitchBootstrap === true
  const nativeCatalogCandidate = nativeBootstrapRequested
    ? buildClaudeNativeCatalog(ctx.configs, mergedAdapterConfig)
    : undefined
  const hasCatalogRoutes = nativeCatalogCandidate != null && nativeCatalogCandidate.routes.length > 0

  let effectiveModel = model
  let modelFallback: string | undefined
  const startsOnCustomModel = typeof effectiveModel === 'string' && effectiveModel.includes(',')

  // CCR (Claude Code Router) is needed whenever starting on a custom (service) model,
  // regardless of whether native bootstrap is enabled. Native bootstrap only controls
  // whether the full model catalog (with builtin passthrough + /model menu) is built.
  const useCCR = startsOnCustomModel

  if (useCCR && hasCatalogRoutes && nativeCatalogCandidate != null && effectiveModel != null && effectiveModel !== '') {
    const inCatalog = nativeCatalogCandidate.routes.some(r => r.selectorValue === effectiveModel)
    if (!inCatalog && nativeCatalogCandidate.defaultRoute != null) {
      modelFallback = nativeCatalogCandidate.defaultRoute.selectorValue
      effectiveModel = modelFallback
    }
  }

  const builtinPassthroughRoutes = useCCR && nativeCatalogCandidate != null
    ? anthropicApiKey != null
      ? nativeCatalogCandidate.routes.filter(r => r.kind === 'builtin_passthrough')
      : []
    : undefined

  // Resolve custom model option from the full catalog candidate — not gated on useCCR.
  // This ensures custom models appear in Claude's /model menu even when starting with
  // a builtin model: the menu is "incremental extension", not a replacement.
  const customModelOption = nativeBootstrapRequested && hasCatalogRoutes
    ? resolveClaudeCustomModelOption({
      nativeCatalog: nativeCatalogCandidate,
      effectiveModel
    })
    : undefined

  if (useCCR) {
    const router = await ensureClaudeCodeRouterReady({
      ...ctx,
      env: {
        ...ctx.env,
        ...settings.env,
        ...(anthropicApiKey != null ? { ANTHROPIC_API_KEY: anthropicApiKey } : {})
      }
    }, builtinPassthroughRoutes)
    settings.env = {
      ...settings.env,
      ANTHROPIC_BASE_URL: `http://${router.host}:${router.port}`,
      ANTHROPIC_AUTH_TOKEN: router.apiKey,
      ANTHROPIC_API_KEY: '',
      API_TIMEOUT_MS: String(router.apiTimeoutMs)
    }
    await persistCCRRequestLogContext({
      cwd,
      ctxId: ctx.ctxId,
      sessionId
    })
  }
  const { mcpServers, ...unresolvedSettings } = settings
  unresolvedSettings.permissions.allow = [
    ...(unresolvedSettings.permissions.allow ?? []),
    ...(inputToolsRule?.include ?? [])
  ]
  unresolvedSettings.permissions.deny = [
    ...(unresolvedSettings.permissions.deny ?? []),
    ...(inputToolsRule?.exclude ?? [])
  ]

  if (options.runtime === 'server') {
    unresolvedSettings.permissions.allow = (unresolvedSettings.permissions.allow ?? [])
      .filter(name => name !== 'AskUserQuestion')
    unresolvedSettings.permissions.deny = uniqueStrings([
      ...(unresolvedSettings.permissions.deny ?? []),
      'AskUserQuestion'
    ])
  }

  const includeMcpServers = inputMCPServersRule?.include ?? settings.defaultIncludeMcpServers
  const excludeMcpServers = inputMCPServersRule?.exclude ?? settings.defaultExcludeMcpServers
  if ((includeMcpServers?.length ?? 0) > 0) {
    Object.keys(mcpServers).forEach((key) => {
      if (!includeMcpServers?.includes(key)) {
        delete mcpServers[key]
      }
    })
  }
  if ((excludeMcpServers?.length ?? 0) > 0) {
    Object.keys(mcpServers).forEach((key) => {
      if (excludeMcpServers?.includes(key)) {
        delete mcpServers[key]
      }
    })
  }

  const { cachePath: mcpCachePath } = await cache.set(
    'adapter.claude-code.mcp',
    { mcpServers }
  )
  const { cachePath: settingsCachePath } = await cache.set(
    'adapter.claude-code.settings',
    settings
  )
  const pluginDirs = await stageClaudePluginDirs({
    cwd,
    ctxId: ctx.ctxId,
    sessionId
  })

  const args: string[] = [
    ...(description
      ? [JSON.stringify(
        `${(
          description?.trimStart().startsWith('-') ? '\0' : ''
        )}${(
          description.replace(/`/g, "'")
        )}`
      )]
      : []),
    '--mcp-config',
    mcpCachePath,
    '--settings',
    settingsCachePath,
    ...pluginDirs.flatMap(pluginDir => ['--plugin-dir', pluginDir])
  ].filter((a) => typeof a === 'string')

  if (permissionMode === 'bypassPermissions') {
    args.push('--dangerously-skip-permissions')
  } else if (
    permissionMode != null &&
    permissionMode !== 'default'
  ) {
    args.push('--permission-mode', permissionMode)
  }

  if (executionType === 'create') {
    args.push('--session-id', sessionId)
  } else {
    args.push('--resume', sessionId)
  }

  if (effectiveModel != null && effectiveModel !== '') args.push('--model', effectiveModel)

  if (systemPrompt != null && systemPrompt !== '') {
    args.push(
      appendSystemPrompt ? '--append-system-prompt' : '--system-prompt',
      systemPrompt.replace(/`/g, "'")
    )
  }

  const executionEnv: Record<string, string | null | undefined> = {
    ...env,
    ...(
      requestedEffort === 'max' &&
        nativeEnvEffort == null &&
        settingsContentEffort == null
        ? { CLAUDE_CODE_EFFORT_LEVEL: 'max' }
        : {}
    ),
    ...nativeEnv,
    ...(customModelOption != null
      ? {
        ANTHROPIC_CUSTOM_MODEL_OPTION: customModelOption.selectorValue,
        ANTHROPIC_CUSTOM_MODEL_OPTION_NAME: customModelOption.title,
        ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION: customModelOption.description ??
          `Custom model (${customModelOption.selectorValue})`
      }
      : {}),
    ...(nativeHooksAvailable
      ? {
        __VF_VIBE_FORGE_CLAUDE_HOOKS_ACTIVE__: '1',
        [NATIVE_HOOK_BRIDGE_ADAPTER_ENV]: 'claude-code',
        __VF_CLAUDE_HOOK_RUNTIME__: options.runtime,
        __VF_CLAUDE_TASK_SESSION_ID__: sessionId
      }
      : {})
  }

  return {
    cliPath: resolveClaudeCliPath(),
    args,
    env: executionEnv,
    cwd,
    sessionId,
    effort: nativeEnvEffort ?? settingsContentEffort ?? requestedEffort,
    executionType,
    nativeCatalog: nativeBootstrapRequested && hasCatalogRoutes ? nativeCatalogCandidate : undefined,
    modelFallback
  }
}
