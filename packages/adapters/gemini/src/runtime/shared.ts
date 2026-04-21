import { Buffer } from 'node:buffer'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import '../adapter-config.js'

import type { ChatMessage } from '@vibe-forge/core'
import { NATIVE_HOOK_BRIDGE_ADAPTER_ENV, resolveMockHome } from '@vibe-forge/hooks'
import type { NativeHookMatcherGroup } from '@vibe-forge/hooks'
import type {
  AdapterCtx,
  AdapterMessageContent,
  AdapterQueryOptions,
  Config,
  ModelServiceConfig
} from '@vibe-forge/types'
import { omitAdapterCommonConfig, parseServiceModelSelector, syncSymlinkTarget } from '@vibe-forge/utils'
import type { ManagedNpmCliConfig } from '@vibe-forge/utils/managed-npm-cli'

import type { GeminiNativeHooksSettings } from './native-hooks'
import { resolveGeminiModelServiceRoute } from './proxy'

export interface GeminiAdapterConfig {
  cli?: ManagedNpmCliConfig
  disableExtensions?: boolean
  disableSubagents?: boolean
  disableAutoUpdate?: boolean
  telemetry?: 'off' | 'inherit'
  nativePromptCommands?: 'reject' | 'allow'
}

export interface GeminiSettings {
  admin?: {
    extensions?: {
      enabled?: boolean
    }
  }
  context?: {
    fileName?: string[]
  }
  experimental?: {
    enableAgents?: boolean
  }
  general?: {
    defaultApprovalMode?: 'default' | 'auto_edit' | 'plan'
    enableAutoUpdate?: boolean
    enableAutoUpdateNotification?: boolean
  }
  hooks?: Record<string, NativeHookMatcherGroup[]>
  hooksConfig?: {
    enabled?: boolean
    disabled?: string[]
  }
  mcpServers?: Record<string, Record<string, unknown>>
  model?: {
    name?: string
  }
  privacy?: {
    usageStatisticsEnabled?: boolean
  }
  telemetry?: {
    enabled?: boolean
    logPrompts?: boolean
  }
  security?: {
    auth?: {
      selectedType?: 'gateway'
      useExternal?: boolean
    }
  }
}

export interface GeminiPromptFiles {
  generatedContextFilePath?: string
  generatedContextFileName?: string
}

export interface GeminiResolvedModel {
  cliModel?: string
  routedService?: ReturnType<typeof resolveGeminiModelServiceRoute>
}

interface GeminiEventInit {
  type: 'init'
  session_id?: string
  model?: string
}

interface GeminiEventMessage {
  type: 'message'
  role?: 'assistant' | 'user'
  content?: string
  delta?: boolean
}

interface GeminiEventToolUse {
  type: 'tool_use'
  tool_name?: string
  tool_id?: string
  parameters?: unknown
}

interface GeminiEventToolResult {
  type: 'tool_result'
  tool_id?: string
  status?: 'success' | 'error'
  output?: unknown
  error?: {
    type?: string
    message?: string
  }
}

interface GeminiEventError {
  type: 'error'
  severity?: 'warning' | 'error'
  message?: string
}

interface GeminiEventResult {
  type: 'result'
  status?: 'success' | 'error'
  error?: {
    type?: string
    message?: string
  }
  stats?: Record<string, unknown>
}

export type GeminiStreamEvent =
  | GeminiEventInit
  | GeminiEventMessage
  | GeminiEventToolUse
  | GeminiEventToolResult
  | GeminiEventError
  | GeminiEventResult

const UNSUPPORTED_CONFIG_KEYS = new Set([
  'apiBaseUrl',
  'apiHost',
  'baseUrl',
  'defaultModelService',
  'modelService',
  'provider',
  'useExternal'
])

const FORBIDDEN_EXTRA_OPTIONS = new Set([
  '-i',
  '-m',
  '-p',
  '-r',
  '-s',
  '--approval-mode',
  '--delete-session',
  '--include-directories',
  '--list-sessions',
  '--model',
  '--output-format',
  '--prompt',
  '--prompt-interactive',
  '--resume',
  '--sandbox',
  '--yolo'
])

const FORBIDDEN_PROMPT_PREFIX = /^\/(?![/*])/
const FORBIDDEN_AT_REFERENCE = /(?:^|[\s(])@(?:\/|\.{1,2}\/|~\/|[a-z]:[\\/])/im

export const MAX_GEMINI_STDIN_BYTES = 8 * 1024 * 1024

const asPlainObject = (value: unknown): Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
)

const normalizeNonEmptyString = (value: unknown) => (
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
)

export const getErrorMessage = (error: unknown) => (
  error instanceof Error ? error.message : String(error ?? 'Gemini session failed unexpectedly')
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

export const toProcessEnv = (env: Record<string, string | null | undefined>) => (
  Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  )
)

const resolveMergedModelServices = (ctx: AdapterCtx): Record<string, ModelServiceConfig> => {
  const [config, userConfig] = ctx.configs
  return {
    ...(config?.modelServices ?? {}),
    ...(userConfig?.modelServices ?? {})
  }
}

const resolveGeminiRoutedModel = (ctx: AdapterCtx, rawModel: string) => {
  const parsed = parseServiceModelSelector(rawModel)
  if (parsed == null) return undefined

  const service = resolveMergedModelServices(ctx)[parsed.serviceKey]
  if (service == null) {
    throw new Error(`Gemini adapter could not find model service "${parsed.serviceKey}".`)
  }

  const wireApi = normalizeNonEmptyString(asPlainObject(asPlainObject(service.extra).codex).wireApi)
  if (wireApi === 'responses') {
    throw new Error(
      `Gemini adapter only supports chat/completions-style model services, but "${parsed.serviceKey}" is configured for Responses API.`
    )
  }

  return resolveGeminiModelServiceRoute({
    serviceKey: parsed.serviceKey,
    model: parsed.modelName,
    service
  })
}

export const resolveGeminiAdapterConfig = (ctx: AdapterCtx): GeminiAdapterConfig => {
  const [config, userConfig] = ctx.configs
  return omitAdapterCommonConfig({
    ...(config?.adapters?.gemini ?? {}),
    ...(userConfig?.adapters?.gemini ?? {})
  }) as GeminiAdapterConfig
}

export const createAssistantMessage = (id: string, content: string, model?: string): ChatMessage => ({
  id,
  role: 'assistant',
  content,
  createdAt: Date.now(),
  ...(model != null ? { model } : {})
})

const normalizeToolToken = (value: string) => (
  value
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map(token => `${token[0]?.toUpperCase() ?? ''}${token.slice(1)}`)
    .join('')
)

export const normalizeGeminiToolName = (name: string) => {
  const normalized = normalizeToolToken(name)
  return normalized === '' ? 'UnknownTool' : normalized
}

export const prefixGeminiToolName = (name: string) => (
  name.startsWith('adapter:gemini:') ? name : `adapter:gemini:${normalizeGeminiToolName(name)}`
)

export const normalizeGeminiPrompt = (content: AdapterMessageContent[]) => {
  const promptParts: string[] = []

  for (const item of content) {
    if (item.type === 'text') {
      const text = item.text.trim()
      if (text !== '') promptParts.push(text)
      continue
    }

    if (item.type === 'image') {
      const imageUrl = item.url.trim()
      if (imageUrl !== '') promptParts.push(`Attached image: ${imageUrl}`)
      continue
    }

    if (item.type === 'file') {
      const filePath = item.path.trim()
      if (filePath !== '') promptParts.push(`Attached file: ${filePath}`)
      continue
    }

    if (item.type === 'tool_result') {
      promptParts.push(String(item.content))
      continue
    }

    if (item.type === 'tool_use') {
      promptParts.push(`Tool request: ${item.name}`)
    }
  }

  return promptParts.join('\n\n').trim() || 'Continue.'
}

export const resolveGeminiApprovalMode = (permissionMode: AdapterQueryOptions['permissionMode']) => {
  switch (permissionMode) {
    case 'acceptEdits':
      return 'auto_edit' as const
    case 'plan':
      return 'plan' as const
    case 'bypassPermissions':
      return 'yolo' as const
    case 'default':
    case 'dontAsk':
    default:
      return 'default' as const
  }
}

export const mapGeminiExitCode = (exitCode: number | null | undefined) => {
  switch (exitCode) {
    case 41:
      return 'auth'
    case 42:
      return 'input'
    case 44:
      return 'sandbox'
    case 52:
      return 'config'
    case 53:
      return 'turn_limit'
    case 54:
      return 'tool_execution'
    case 130:
      return 'cancelled'
    default:
      return exitCode === 0 ? undefined : 'process_exit'
  }
}

export const resolveGeminiModel = (params: {
  ctx: AdapterCtx
  model?: string
}): GeminiResolvedModel => {
  const normalizedModel = params.model?.trim()
  if (normalizedModel == null || normalizedModel === '') {
    return {
      cliModel: params.model
    }
  }

  const routedService = resolveGeminiRoutedModel(params.ctx, normalizedModel)
  if (routedService != null) {
    return {
      cliModel: routedService.model,
      routedService
    }
  }

  return {
    cliModel: normalizedModel
  }
}

export const validateGeminiSelection = (params: {
  ctx: AdapterCtx
  extraOptions?: string[]
  model?: string
  prompt?: string
}) => {
  const adapterConfig = resolveGeminiAdapterConfig(params.ctx)
  const configEntries = Object.entries(adapterConfig as Record<string, unknown>)

  const unsupportedConfigKey = configEntries.find(([key]) => UNSUPPORTED_CONFIG_KEYS.has(key))?.[0]
  if (unsupportedConfigKey != null) {
    throw new Error(
      `Gemini adapter does not support adapters.gemini.${unsupportedConfigKey}. Configure external providers with modelServices instead.`
    )
  }

  resolveGeminiModel({
    ctx: params.ctx,
    model: params.model
  })

  if (typeof params.ctx.env.GEMINI_SANDBOX === 'string' && params.ctx.env.GEMINI_SANDBOX.trim() !== '') {
    throw new Error('Gemini adapter does not support GEMINI_SANDBOX. Remove the variable and retry.')
  }

  for (const option of params.extraOptions ?? []) {
    if (FORBIDDEN_EXTRA_OPTIONS.has(option)) {
      throw new Error(`Gemini adapter does not allow extra option "${option}".`)
    }
  }

  if (adapterConfig.nativePromptCommands !== 'allow') {
    const prompt = params.prompt?.trimStart() ?? ''
    if (FORBIDDEN_PROMPT_PREFIX.test(prompt)) {
      throw new Error('Gemini slash commands are disabled in the adapter. Send plain text instead.')
    }
    if (FORBIDDEN_AT_REFERENCE.test(prompt)) {
      throw new Error(
        'Gemini @path prompt expansion is disabled in the adapter. Reference files with plain text instead.'
      )
    }
  }
}

const resolveGeneratedContextFilePath = (ctx: AdapterCtx, sessionId: string) =>
  resolve(
    ctx.cwd,
    '.ai',
    '.mock',
    '.gemini-adapter',
    sessionId,
    'VIBE_FORGE.md'
  )

export const ensureGeminiPromptFiles = async (
  ctx: AdapterCtx,
  options: Pick<AdapterQueryOptions, 'sessionId' | 'systemPrompt'>
): Promise<GeminiPromptFiles> => {
  if (options.systemPrompt == null || options.systemPrompt.trim() === '') {
    return {}
  }

  const generatedContextFilePath = resolveGeneratedContextFilePath(ctx, options.sessionId)
  await mkdir(resolve(generatedContextFilePath, '..'), { recursive: true })
  await writeFile(generatedContextFilePath, options.systemPrompt)

  return {
    generatedContextFilePath,
    generatedContextFileName: `.ai/.mock/.gemini-adapter/${options.sessionId}/VIBE_FORGE.md`
  }
}

const translateMcpServerConfig = (server: NonNullable<Config['mcpServers']>[string]) => {
  const { env, ...rest } = server
  if (rest.type === 'sse') {
    return {
      url: rest.url,
      headers: rest.headers
    }
  }
  if (rest.type === 'http') {
    return {
      httpUrl: rest.url,
      headers: rest.headers
    }
  }
  return {
    command: rest.command,
    args: rest.args,
    ...(env != null ? { env } : {})
  }
}

export const buildGeminiSettings = (params: {
  adapterConfig: GeminiAdapterConfig
  approvalMode: ReturnType<typeof resolveGeminiApprovalMode>
  externalAuth?: boolean
  generatedContextFileName?: string
  mcpServers: Record<string, NonNullable<Config['mcpServers']>[string]>
  model?: string
  nativeHooks?: GeminiNativeHooksSettings
}): GeminiSettings => {
  const {
    adapterConfig,
    approvalMode,
    externalAuth,
    generatedContextFileName,
    mcpServers,
    model,
    nativeHooks
  } = params

  const telemetryOff = adapterConfig.telemetry !== 'inherit'
  const settings: GeminiSettings = {
    model: model == null ? undefined : { name: model },
    general: {
      ...(approvalMode === 'yolo' ? {} : { defaultApprovalMode: approvalMode }),
      enableAutoUpdate: adapterConfig.disableAutoUpdate === false,
      enableAutoUpdateNotification: adapterConfig.disableAutoUpdate === false
    },
    experimental: {
      enableAgents: adapterConfig.disableSubagents !== false ? false : undefined
    },
    admin: {
      extensions: {
        enabled: adapterConfig.disableExtensions !== false ? false : undefined
      }
    },
    ...(externalAuth
      ? {
        security: {
          auth: {
            selectedType: 'gateway',
            useExternal: true
          }
        }
      }
      : {}),
    ...(telemetryOff
      ? {
        telemetry: {
          enabled: false,
          logPrompts: false
        },
        privacy: {
          usageStatisticsEnabled: false
        }
      }
      : {}),
    ...(generatedContextFileName == null
      ? {}
      : {
        context: {
          fileName: ['GEMINI.md', generatedContextFileName]
        }
      }),
    ...(Object.keys(mcpServers).length === 0
      ? {}
      : {
        mcpServers: Object.fromEntries(
          Object.entries(mcpServers).map(([name, server]) => [name, translateMcpServerConfig(server)])
        )
      }),
    ...(nativeHooks?.hooksConfig == null ? {} : { hooksConfig: nativeHooks.hooksConfig }),
    ...(nativeHooks?.hooks == null ? {} : { hooks: nativeHooks.hooks })
  }

  return settings
}

export const writeGeminiSettings = async (ctx: AdapterCtx, settings: GeminiSettings) => {
  const mockHome = resolveMockHome(ctx.cwd, ctx.env)
  const settingsPath = resolve(mockHome, '.gemini', 'settings.json')
  await mkdir(resolve(settingsPath, '..'), { recursive: true })
  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`)
  return settingsPath
}

export const buildGeminiSpawnEnv = (params: {
  adapterConfig: GeminiAdapterConfig
  ctx: AdapterCtx
  model?: string
  proxyBaseUrl?: string
  runtime?: AdapterQueryOptions['runtime']
  sessionId?: string
}): Record<string, string | undefined> => {
  const { adapterConfig, ctx, model, proxyBaseUrl, runtime, sessionId } = params
  const mockHome = resolveMockHome(ctx.cwd, ctx.env)
  const nativeHooksActive = ctx.env.__VF_PROJECT_AI_GEMINI_NATIVE_HOOKS_AVAILABLE__ === '1'

  return {
    ...toProcessEnv({
      ...ctx.env,
      GEMINI_CLI_HOME: mockHome,
      GEMINI_CLI_NO_RELAUNCH: 'true',
      NO_BROWSER: 'true',
      GEMINI_TELEMETRY_ENABLED: adapterConfig.telemetry === 'inherit' ? undefined : 'false',
      GEMINI_TELEMETRY_LOG_PROMPTS: adapterConfig.telemetry === 'inherit' ? undefined : 'false',
      GEMINI_CLI_IDE_WORKSPACE_PATH: undefined,
      GEMINI_CLI_CUSTOM_HEADERS: undefined,
      GEMINI_SANDBOX: undefined,
      GEMINI_SYSTEM_MD: undefined,
      GEMINI_WRITE_SYSTEM_MD: undefined,
      GOOGLE_GEMINI_BASE_URL: proxyBaseUrl,
      GOOGLE_VERTEX_BASE_URL: undefined,
      __VF_GEMINI_HOOK_MODEL__: nativeHooksActive ? model : undefined,
      __VF_GEMINI_HOOK_RUNTIME__: nativeHooksActive ? runtime : undefined,
      __VF_GEMINI_TASK_SESSION_ID__: nativeHooksActive ? sessionId : undefined,
      __VF_VIBE_FORGE_GEMINI_HOOKS_ACTIVE__: nativeHooksActive ? '1' : undefined,
      [NATIVE_HOOK_BRIDGE_ADAPTER_ENV]: nativeHooksActive ? 'gemini' : undefined
    })
  }
}

export const resolveGeminiMockHome = (ctx: Pick<AdapterCtx, 'cwd' | 'env'>) => (
  resolveMockHome(ctx.cwd, ctx.env)
)

export const syncGeminiMockHomeSymlink = async (params: {
  sourcePath: string
  targetPath: string
}) => {
  await syncSymlinkTarget({
    ...params,
    type: 'dir',
    onMissingSource: 'remove'
  })
}

export const buildGeminiRunArgs = (params: {
  approvalMode: ReturnType<typeof resolveGeminiApprovalMode>
  extraOptions?: string[]
  model?: string
  resumeSessionId?: string
}) => {
  const args = [
    '--output-format',
    'stream-json'
  ]

  if (params.model != null && params.model.trim() !== '') {
    args.push('--model', params.model)
  }

  if (params.resumeSessionId != null && params.resumeSessionId.trim() !== '') {
    args.push('--resume', params.resumeSessionId)
  }

  if (params.approvalMode === 'yolo') {
    args.push('--approval-mode', 'yolo')
  } else if (params.approvalMode !== 'default') {
    args.push('--approval-mode', params.approvalMode)
  } else {
    args.push('--approval-mode', 'default')
  }

  return [...args, ...(params.extraOptions ?? [])]
}

export const buildGeminiDirectArgs = (params: {
  approvalMode: ReturnType<typeof resolveGeminiApprovalMode>
  extraOptions?: string[]
  model?: string
  prompt?: string
  resumeSessionId?: string
}) => {
  const args: string[] = []

  if (params.model != null && params.model.trim() !== '') {
    args.push('--model', params.model)
  }

  if (params.resumeSessionId != null && params.resumeSessionId.trim() !== '') {
    args.push('--resume', params.resumeSessionId)
  }

  if (params.approvalMode === 'yolo') {
    args.push('--approval-mode', 'yolo')
  } else if (params.approvalMode !== 'default') {
    args.push('--approval-mode', params.approvalMode)
  } else {
    args.push('--approval-mode', 'default')
  }

  if (params.prompt != null && params.prompt.trim() !== '') {
    args.push('--prompt-interactive', params.prompt)
  }

  return [...args, ...(params.extraOptions ?? [])]
}

const collectGeminiChatFiles = async (directoryPath: string): Promise<string[]> => {
  let entries
  try {
    entries = await readdir(directoryPath, { withFileTypes: true })
  } catch {
    return []
  }

  const nestedFiles = await Promise.all(entries.map(async (entry) => {
    const entryPath = resolve(directoryPath, entry.name)
    if (entry.isDirectory()) {
      return collectGeminiChatFiles(entryPath)
    }
    return entry.isFile() && entry.name.startsWith('session-') && entry.name.endsWith('.json')
      ? [entryPath]
      : []
  }))

  return nestedFiles.flat()
}

export const resolveLatestGeminiSessionId = async (params: {
  ctx: Pick<AdapterCtx, 'cwd' | 'env' | 'logger'>
  minMtimeMs?: number
}) => {
  const mockHome = resolveMockHome(params.ctx.cwd, params.ctx.env)
  const chatFiles = await collectGeminiChatFiles(resolve(mockHome, '.gemini', 'tmp'))
  const sessionRecords = await Promise.all(chatFiles.map(async (filePath) => {
    try {
      const fileStats = await stat(filePath)
      if (params.minMtimeMs != null && fileStats.mtimeMs < params.minMtimeMs) {
        return undefined
      }

      const raw = await readFile(filePath, 'utf8')
      const parsed = JSON.parse(raw) as { sessionId?: unknown }
      return typeof parsed.sessionId === 'string' && parsed.sessionId.trim() !== ''
        ? {
          mtimeMs: fileStats.mtimeMs,
          sessionId: parsed.sessionId
        }
        : undefined
    } catch (error) {
      params.ctx.logger.warn('Failed to inspect Gemini session transcript', { filePath, err: error })
      return undefined
    }
  }))

  return sessionRecords
    .filter((record): record is NonNullable<typeof record> => record != null)
    .sort((left, right) => right.mtimeMs - left.mtimeMs)[0]
    ?.sessionId
}

export const ensureGeminiPromptSize = (prompt: string) => {
  const promptBytes = Buffer.byteLength(prompt)
  if (promptBytes > MAX_GEMINI_STDIN_BYTES) {
    throw new Error(`Gemini prompt exceeds the ${MAX_GEMINI_STDIN_BYTES} byte stdin limit.`)
  }
}
