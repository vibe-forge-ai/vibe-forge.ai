import type { Cache } from './cache'
import type { EffortLevel, TaskRuntime } from './common'
import type { Config } from './config'
import type { AskUserQuestionParams } from './interaction'
import type { Logger } from './logger'
import type { ChatMessage, ChatMessageContent } from './message'
import type { AdapterModelFallbackWarning } from './model-selection'
import type { AdapterPluginInstaller } from './native-plugin'
import type { AdapterAssetPlan, AssetDiagnostic, WorkspaceAssetBundle } from './workspace'

export type AdapterMessageContent = ChatMessageContent

export interface AdapterErrorData {
  message: string
  code?: string
  details?: unknown
  fatal?: boolean
}

export interface AdapterInteractionRequest {
  id: string
  payload: AskUserQuestionParams
}

export type AdapterOutputEvent =
  | { type: 'init'; data: SessionInitInfo }
  | { type: 'summary'; data: SessionSummaryInfo }
  | { type: 'message'; data: ChatMessage }
  | { type: 'interaction_request'; data: AdapterInteractionRequest }
  | { type: 'error'; data: AdapterErrorData }
  | { type: 'exit'; data: { exitCode?: number; stderr?: string } }
  | { type: 'stop'; data?: ChatMessage }

export type SessionInfo =
  | ({ type: 'init' } & SessionInitInfo)
  | ({ type: 'summary' } & SessionSummaryInfo)

export interface SessionInitInfo {
  uuid: string
  model: string
  adapter?: string
  effort?: EffortLevel
  version: string
  tools: string[]
  slashCommands: string[]
  cwd: string
  agents: string[]
  title?: string
  selectionWarnings?: AdapterModelFallbackWarning[]
  assetDiagnostics?: AssetDiagnostic[]
}

export interface SessionSummaryInfo {
  summary: string
  leafUuid: string
}

export type AdapterEvent =
  | { type: 'message'; content: AdapterMessageContent[]; parentUuid?: string }
  | { type: 'interrupt' }
  | { type: 'stop' }

export interface AdapterCtx {
  ctxId: string
  cwd: string
  env: Record<string, string | null | undefined>
  cache: {
    set: <K extends keyof Cache>(key: K, value: Cache[K]) => Promise<{
      cachePath: string
    }>
    get: <K extends keyof Cache>(key: K) => Promise<Cache[K] | undefined>
  }
  logger: Logger
  configs: [Config?, Config?]
  assets?: WorkspaceAssetBundle
}

export interface AdapterQueryOptions {
  description?: string
  type: 'create' | 'resume'
  runtime: TaskRuntime
  sessionId: string
  model?: string
  effort?: EffortLevel
  mode?: 'stream' | 'direct'
  systemPrompt?: string
  appendSystemPrompt?: boolean
  permissionMode?: 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions'
  mcpServers?: {
    include?: string[]
    exclude?: string[]
  }
  useDefaultVibeForgeMcpServer?: boolean
  tools?: {
    include?: string[]
    exclude?: string[]
  }
  skills?: {
    include?: string[]
    exclude?: string[]
  }
  extraOptions?: string[]
  promptAssetIds?: string[]
  assetBundle?: WorkspaceAssetBundle
  assetPlan?: AdapterAssetPlan
  onEvent: (event: AdapterOutputEvent) => void
}

export interface AdapterSession {
  kill: () => void
  stop?: () => void
  emit: (event: AdapterEvent) => void
  respondInteraction?: (interactionId: string, data: string | string[]) => void | Promise<void>
  pid?: number
}

export interface Adapter {
  init?: (
    ctx: AdapterCtx
  ) => Promise<void>
  query: (
    ctx: AdapterCtx,
    options: AdapterQueryOptions
  ) => Promise<AdapterSession>
}

const ADAPTER_SCOPE = '@vibe-forge'
const ADAPTER_PREFIX = 'adapter-'
const ADAPTER_PLUGIN_EXPORT = '/plugins'

export const normalizeAdapterPackageId = (type: string) => {
  const trimmed = type.trim()
  if (trimmed.startsWith('@')) return trimmed

  const hasAdapterPrefix = trimmed.startsWith(ADAPTER_PREFIX)
  const adapterId = hasAdapterPrefix ? trimmed.slice(ADAPTER_PREFIX.length) : trimmed
  const normalizedAdapterId = adapterId === 'claude' ? 'claude-code' : adapterId

  return hasAdapterPrefix ? `${ADAPTER_PREFIX}${normalizedAdapterId}` : normalizedAdapterId
}

export const resolveAdapterPackageName = (type: string) => {
  const normalizedType = normalizeAdapterPackageId(type)
  if (normalizedType.startsWith('@')) return normalizedType
  return normalizedType.startsWith(ADAPTER_PREFIX)
    ? `${ADAPTER_SCOPE}/${normalizedType}`
    : `${ADAPTER_SCOPE}/${ADAPTER_PREFIX}${normalizedType}`
}

export const loadAdapter = async (type: string) =>
  (
    // eslint-disable-next-line ts/no-require-imports
    require(resolveAdapterPackageName(type))
  ).default as Adapter

export const loadAdapterPluginInstaller = async (type: string) => {
  const packageName = resolveAdapterPackageName(type)
  const exportName = `${packageName}${ADAPTER_PLUGIN_EXPORT}`

  try {
    return (
      // eslint-disable-next-line ts/no-require-imports
      require(exportName)
    ).default as AdapterPluginInstaller
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code
    const message = error instanceof Error ? error.message : String(error)
    if (
      code === 'ERR_PACKAGE_PATH_NOT_EXPORTED' ||
      (code === 'MODULE_NOT_FOUND' && message.includes(exportName))
    ) {
      throw new Error(`Adapter ${type} does not support native plugin management.`)
    }
    throw error
  }
}

export const defineAdapter = <T extends Adapter>(adapter: T): Adapter => adapter
