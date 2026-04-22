/* eslint-disable max-lines -- adapter contracts and loader types stay colocated for shared exports. */
import type { Cache } from './cache'
import type { EffortLevel, TaskRuntime } from './common'
import type { Config } from './config'
import type { AskUserQuestionParams } from './interaction'
import type { Logger } from './logger'
import type { ChatMessage, ChatMessageContent } from './message'
import type { AdapterModelFallbackWarning } from './model-selection'
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

export interface AdapterConfigState {
  projectConfig?: Config
  userConfig?: Config
  mergedConfig: Config
}

export interface SessionInitInfo {
  uuid: string
  model: string
  adapter?: string
  account?: string
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
  configState?: AdapterConfigState
  assets?: WorkspaceAssetBundle
}

export interface AdapterAccountQuotaMetric {
  id: string
  label: string
  value?: string
  description?: string
  primary?: boolean
}

export interface AdapterAccountQuotaInfo {
  summary?: string
  metrics?: AdapterAccountQuotaMetric[]
  updatedAt?: number
}

export interface AdapterAccountActionDescriptor {
  key: 'add' | 'refresh' | 'remove'
  label: string
  description?: string
  scope?: 'adapter' | 'account'
}

export interface AdapterAccountSourceInfo {
  id: string
  label: string
  description?: string
}

export interface AdapterAccountInfo {
  key: string
  title: string
  description?: string
  status?: 'ready' | 'missing' | 'error'
  isDefault?: boolean
  quota?: AdapterAccountQuotaInfo
}

export interface AdapterAccountDetail extends AdapterAccountInfo {
  email?: string
  planType?: string
  accountType?: string
  source?: AdapterAccountSourceInfo
  actions?: AdapterAccountActionDescriptor[]
}

export interface AdapterAccountsQueryOptions {
  model?: string
  account?: string
  refresh?: boolean
}

export interface AdapterAccountsResult {
  defaultAccount?: string
  accounts: AdapterAccountInfo[]
  actions?: AdapterAccountActionDescriptor[]
}

export interface AdapterAccountDetailQueryOptions {
  model?: string
  account: string
  refresh?: boolean
}

export interface AdapterAccountDetailResult {
  account: AdapterAccountDetail
}

export interface AdapterAccountCredentialArtifact {
  path: string
  content: string
}

export interface AdapterManageAccountProgressEvent {
  stream: 'stdout' | 'stderr' | 'status'
  message: string
}

export interface AdapterManageAccountOptions {
  action: 'add' | 'refresh' | 'remove'
  model?: string
  account?: string
  refresh?: boolean
  onProgress?: (event: AdapterManageAccountProgressEvent) => void
  signal?: AbortSignal
}

export interface AdapterManageAccountResult {
  accountKey?: string
  message?: string
  account?: AdapterAccountDetail
  artifacts?: AdapterAccountCredentialArtifact[]
  removeStoredAccount?: boolean
}

export interface AdapterQueryOptions {
  description?: string
  type: 'create' | 'resume'
  runtime: TaskRuntime
  sessionId: string
  model?: string
  account?: string
  effort?: EffortLevel
  mode?: 'stream' | 'direct'
  systemPrompt?: string
  appendSystemPrompt?: boolean
  permissionMode?: 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions'
  mcpServers?: {
    include?: string[]
    exclude?: string[]
  }
  runtimeMcpServers?: Config['mcpServers']
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
  getAccounts?: (
    ctx: AdapterCtx,
    options: AdapterAccountsQueryOptions
  ) => Promise<AdapterAccountsResult>
  getAccountDetail?: (
    ctx: AdapterCtx,
    options: AdapterAccountDetailQueryOptions
  ) => Promise<AdapterAccountDetailResult>
  manageAccount?: (
    ctx: AdapterCtx,
    options: AdapterManageAccountOptions
  ) => Promise<AdapterManageAccountResult>
  query: (
    ctx: AdapterCtx,
    options: AdapterQueryOptions
  ) => Promise<AdapterSession>
}

export const defineAdapter = <T extends Adapter>(adapter: T): Adapter => adapter
