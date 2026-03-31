import type { EffortLevel } from './common'

export type SessionStatus = 'running' | 'completed' | 'failed' | 'terminated' | 'waiting_input'

export type SessionPermissionMode = 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions'

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
