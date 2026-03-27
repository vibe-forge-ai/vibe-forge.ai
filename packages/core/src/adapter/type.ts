import type { Cache, Config } from '@vibe-forge/core'
import type { AdapterModelFallbackWarning } from '#~/utils/model-selection.js'

import type { Logger } from '#~/utils/create-logger.js'
import type { AdapterAssetPlan, AssetDiagnostic, WorkspaceAssetBundle } from '#~/utils/workspace-assets.js'
import type { ChatMessage, ChatMessageContent } from '../types'

export type { AssetDiagnostic } from '#~/utils/workspace-assets.js'

export type AdapterMessageContent = ChatMessageContent

export interface AdapterErrorData {
  message: string
  code?: string
  details?: unknown
  fatal?: boolean
}

export type AdapterOutputEvent =
  | { type: 'init'; data: SessionInitInfo }
  | { type: 'summary'; data: SessionSummaryInfo }
  | { type: 'message'; data: ChatMessage }
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
  runtime: 'server' | 'cli' | 'mcp'
  sessionId: string
  model?: string
  mode?: 'stream' | 'direct'

  systemPrompt?: string
  appendSystemPrompt?: boolean
  permissionMode?: 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions'

  mcpServers?: {
    include?: string[]
    exclude?: string[]
  }
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
  assetPlan?: AdapterAssetPlan

  onEvent: (event: AdapterOutputEvent) => void
}

export interface AdapterSession {
  kill: () => void
  emit: (event: AdapterEvent) => void
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
