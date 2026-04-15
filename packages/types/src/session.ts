import type { EffortLevel } from './common'

export type SessionStatus = 'running' | 'completed' | 'failed' | 'terminated' | 'waiting_input'

export type SessionPermissionMode = 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions'
export type SessionWorkspaceKind = 'managed_worktree' | 'shared_workspace' | 'external_workspace'
export type SessionWorkspaceState = 'provisioning' | 'ready' | 'deleting' | 'deleted' | 'broken'
export type SessionWorkspaceCleanupPolicy = 'delete_on_session_delete' | 'retain'

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

export interface SessionWorkspace {
  sessionId: string
  kind: SessionWorkspaceKind
  workspaceFolder: string
  repositoryRoot?: string
  worktreePath?: string
  baseRef?: string
  cleanupPolicy: SessionWorkspaceCleanupPolicy
  state: SessionWorkspaceState
  lastError?: string
  createdAt: number
  updatedAt: number
  deletedAt?: number
}
