import type { Cache, Config, Settings } from '@vibe-forge/core'

import type { Logger } from '#~/utils/create-logger'

import type { ChatMessage, ChatMessageContent } from '../types'

export type AdapterMessageContent = ChatMessageContent

export type AdapterOutputEvent =
  | { type: 'init'; data: SessionInitInfo }
  | { type: 'summary'; data: SessionSummaryInfo }
  | { type: 'message'; data: ChatMessage }
  | { type: 'exit'; data: { exitCode: number | null; stderr?: string } }

export type SessionInfo =
  | ({ type: 'init' } & SessionInitInfo)
  | ({ type: 'summary' } & SessionSummaryInfo)

export interface SessionInitInfo {
  uuid: string
  model: string
  version: string
  tools: string[]
  slashCommands: string[]
  cwd: string
  agents: string[]
  title?: string
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
  taskId: string

  cwd: string
  env: Record<string, string | undefined>

  cache: {
    set: <K extends keyof Cache>(key: K, value: Cache[K]) => Promise<{
      cachePath: string
    }>
    get: <K extends keyof Cache>(key: K) => Promise<Cache[K] | undefined>
  }
  logger: Logger

  configs: [Config?, Config?]
  settings: Settings
}

export interface AdapterQueryOptions {
  type: 'create' | 'resume'
  sessionId: string
  model?: string
  mode?: 'stream' | 'direct'

  systemPrompt?: string
  appendSystemPrompt?: boolean

  mcpServers?: {
    include: string[]
    exclude: string[]
  }
  tools?: {
    include: string[]
    exclude: string[]
  }

  onEvent: (event: AdapterOutputEvent) => void
}

export interface AdapterSession {
  kill: () => void
  emit: (event: AdapterEvent) => void
}

export interface Adapter {
  query: (
    ctx: AdapterCtx,
    options: AdapterQueryOptions
  ) => Promise<AdapterSession>
}
