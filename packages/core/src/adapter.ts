import type { ChatMessage, ChatMessageContent } from './types.js'

export interface AdapterOptions {
  env: Record<string, string>
  cwd: string
  sessionId: string
  type: 'create' | 'resume'
  model?: string
  systemPrompt?: string
  appendSystemPrompt?: boolean
  onEvent: (event: AdapterOutputEvent) => void
}

export type AdapterMessageContent = ChatMessageContent

export type AdapterOutputEvent =
  | { type: 'init'; data: SessionInitInfo }
  | { type: 'message'; data: ChatMessage }
  | { type: 'exit'; data: { exitCode: number | null; stderr?: string } }
  | { type: 'summary'; data: SessionSummaryInfo }
  | { type: 'raw'; data: any }

export type SessionInfo =
  | ({ type: 'init' } & SessionInitInfo)
  | ({ type: 'summary' } & SessionSummaryInfo)

export interface SessionInitInfo {
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

export interface AdapterSession {
  kill: () => void
  emit: (event: AdapterEvent) => void
}

export interface Adapter {
  query: (options: AdapterOptions) => AdapterSession
}
