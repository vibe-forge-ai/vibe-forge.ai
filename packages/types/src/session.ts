import type { EffortLevel } from './common'
import type { ChatMessageContent } from './message'

export type SessionStatus = 'running' | 'completed' | 'failed' | 'terminated' | 'waiting_input'

export type SessionPermissionMode = 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions'

export type SessionQueuedMessageMode = 'steer' | 'next'

export interface SessionQueuedMessage {
  id: string
  sessionId: string
  mode: SessionQueuedMessageMode
  content: ChatMessageContent[]
  createdAt: number
  updatedAt: number
  order: number
}

export interface SessionMessageQueueState {
  steer: SessionQueuedMessage[]
  next: SessionQueuedMessage[]
}

export interface Session {
  id: string
  parentSessionId?: string
  title?: string
  createdAt: number
  messageCount?: number
  lastMessage?: string
  lastUserMessage?: string
  isStarred?: boolean
  isArchived?: boolean
  tags?: string[]
  status?: SessionStatus
  model?: string
  adapter?: string
  permissionMode?: SessionPermissionMode
  effort?: EffortLevel
}
