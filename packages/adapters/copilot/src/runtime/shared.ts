import { lstat, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'

import type {
  AdapterCtx,
  AdapterMessageContent,
  AdapterQueryOptions,
  ChatMessage,
  Config,
  ModelServiceConfig
} from '@vibe-forge/types'
import { omitAdapterCommonConfig } from '@vibe-forge/utils'
import { createLogger } from '@vibe-forge/utils/create-logger'
import { uuid } from '@vibe-forge/utils/uuid'

import { registerCopilotProviderProxyRoute } from './provider-proxy'

export interface CopilotAdapterConfig {
  cliPath?: string
  configDir?: string
  disableWorkspaceTrust?: boolean
  logDir?: string
  logLevel?: 'none' | 'error' | 'warning' | 'info' | 'debug' | 'all'
  agent?: string
  stream?: boolean
  allowAll?: boolean
  allowAllTools?: boolean
  allowAllPaths?: boolean
  allowAllUrls?: boolean
  disableBuiltinMcps?: boolean
  disabledMcpServers?: string[]
  enableAllGithubMcpTools?: boolean
  additionalGithubMcpToolsets?: string[]
  additionalGithubMcpTools?: string[]
  noCustomInstructions?: boolean
  noAskUser?: boolean
}

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
  return omitAdapterCommonConfig({
    ...(config?.adapters?.copilot ?? {}),
    ...(userConfig?.adapters?.copilot ?? {})
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
  args.push(flag, ...normalized)
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

const ensureCopilotWorkspaceTrust = async (
  ctx: AdapterCtx,
  adapterConfig: CopilotAdapterConfig,
  configDir: string
) => {
  if (adapterConfig.disableWorkspaceTrust === true) return

  const configPath = resolve(configDir, 'config.json')
  let rawContent = ''
  let rawConfig: Record<string, unknown> = {}

  try {
    rawContent = await readFile(configPath, 'utf8')
    rawConfig = asPlainObject(JSON.parse(rawContent)) ?? {}
  } catch (error) {
    const code = typeof error === 'object' && error != null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : undefined
    if (code !== 'ENOENT') {
      ctx.logger.warn('Failed to read existing Copilot managed config; rewriting workspace trust config', {
        err: error
      })
    }
  }

  const trustedFolders = Array.from(
    new Set([
      ...asStringList(rawConfig.trusted_folders),
      ...asStringList(rawConfig.trustedFolders),
      ctx.cwd
    ])
  )
  const nextConfig: Record<string, unknown> = {
    ...rawConfig,
    trusted_folders: trustedFolders
  }
  delete nextConfig.trustedFolders

  const nextContent = `${JSON.stringify(nextConfig, null, 2)}\n`
  if (rawContent === nextContent) return
  await writeFile(configPath, nextContent, 'utf8')
}

export const ensureCopilotSessionMarker = async (ctx: AdapterCtx, sessionId: string) => {
  await ctx.cache.set('adapter.copilot.session', {
    copilotSessionId: sessionId,
    title: `Vibe Forge:${sessionId}`
  })
}

const ensureSymlinkTarget = async (sourcePath: string, targetPath: string) => {
  try {
    const existing = await lstat(targetPath)
    if (existing.isSymbolicLink() || existing.isDirectory() || existing.isFile()) {
      await rm(targetPath, { recursive: true, force: true })
    }
  } catch {
  }

  await mkdir(dirname(targetPath), { recursive: true })
  await symlink(sourcePath, targetPath)
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
  await ensureCopilotWorkspaceTrust(ctx, adapterConfig, configDir)
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
      : {})
  })
}

const buildPermissionArgs = (
  options: AdapterQueryOptions,
  adapterConfig: CopilotAdapterConfig
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
  if (adapterConfig.noAskUser === true || options.permissionMode === 'dontAsk') args.push('--no-ask-user')
  if (options.permissionMode === 'plan') args.push('--plan')

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
    '--no-remote',
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

  args.push(...buildPermissionArgs(options, adapterConfig))

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
