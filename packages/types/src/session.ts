import type { EffortLevel } from './common'
import type { ChatMessageContent } from './message'

export type SessionStatus = 'running' | 'completed' | 'failed' | 'terminated' | 'waiting_input'

export type SessionPermissionMode = 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions'
export type SessionPromptType = 'spec' | 'entity' | 'workspace'
export type SessionWorkspaceKind = 'managed_worktree' | 'shared_workspace' | 'external_workspace'
export type SessionWorkspaceState = 'provisioning' | 'ready' | 'deleting' | 'deleted' | 'broken'
export type SessionWorkspaceCleanupPolicy = 'delete_on_session_delete' | 'retain'

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

export interface SessionWorkspaceFileState {
  openPaths: string[]
  selectedPath?: string
  isOpen?: boolean
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
  promptType?: SessionPromptType
  promptName?: string
  workspaceFileState?: SessionWorkspaceFileState
}

export interface SessionWorkspace {
  sessionId: string
  kind: SessionWorkspaceKind
  workspaceFolder: string
  repositoryRoot?: string
  worktreePath?: string
  baseRef?: string
  worktreeEnvironment?: string
  cleanupPolicy: SessionWorkspaceCleanupPolicy
  state: SessionWorkspaceState
  lastError?: string
  createdAt: number
  updatedAt: number
  deletedAt?: number
}
