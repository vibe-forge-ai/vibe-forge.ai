import type { ConfigResponse, GitBranchKind } from '@vibe-forge/types'

export interface ChatSessionWorkspaceDraftBranch {
  name: string
  kind?: GitBranchKind
  mode: 'checkout' | 'create'
}

export interface ChatSessionWorkspaceDraft {
  createWorktree: boolean
  branch?: ChatSessionWorkspaceDraftBranch
}

export const buildChatSessionWorkspaceDraft = (createWorktree = true): ChatSessionWorkspaceDraft => ({
  createWorktree
})

export const getChatSessionWorkspaceDraftFromConfig = (
  configRes?: ConfigResponse
): ChatSessionWorkspaceDraft => {
  const createWorktree = configRes?.sources?.merged?.conversation?.createSessionWorktree
  return buildChatSessionWorkspaceDraft(createWorktree ?? true)
}

export const DEFAULT_CHAT_SESSION_WORKSPACE_DRAFT: ChatSessionWorkspaceDraft = buildChatSessionWorkspaceDraft()
