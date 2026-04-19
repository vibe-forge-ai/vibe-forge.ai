import type { ConfigResponse, GitBranchKind } from '@vibe-forge/types'

export interface ChatSessionWorkspaceDraftBranch {
  name: string
  kind?: GitBranchKind
  mode: 'checkout' | 'create'
}

export interface ChatSessionWorkspaceDraft {
  createWorktree: boolean
  worktreeEnvironment?: string
  branch?: ChatSessionWorkspaceDraftBranch
}

export const buildChatSessionWorkspaceDraft = (
  createWorktree = true,
  worktreeEnvironment?: string
): ChatSessionWorkspaceDraft => ({
  createWorktree,
  ...(worktreeEnvironment != null && worktreeEnvironment.trim() !== ''
    ? { worktreeEnvironment: worktreeEnvironment.trim() }
    : {})
})

export const getChatSessionWorkspaceDraftFromConfig = (
  configRes?: ConfigResponse
): ChatSessionWorkspaceDraft => {
  const conversation = configRes?.sources?.merged?.conversation
  return buildChatSessionWorkspaceDraft(conversation?.createSessionWorktree ?? true, conversation?.worktreeEnvironment)
}

export const DEFAULT_CHAT_SESSION_WORKSPACE_DRAFT: ChatSessionWorkspaceDraft = buildChatSessionWorkspaceDraft()
