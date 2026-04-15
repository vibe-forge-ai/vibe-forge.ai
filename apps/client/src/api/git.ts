import type {
  GitBranchKind,
  GitBranchListResult,
  GitCommitPayload,
  GitMutationResult,
  GitPushPayload,
  GitRepositoryState,
  GitWorktreeListResult
} from '@vibe-forge/types'

import { fetchApiJson, jsonHeaders } from './base'

export async function getSessionGitState(sessionId: string): Promise<GitRepositoryState> {
  return fetchApiJson<GitRepositoryState>(`/api/sessions/${sessionId}/git`)
}

export async function getWorkspaceGitState(): Promise<GitRepositoryState> {
  return fetchApiJson<GitRepositoryState>('/api/workspace/git')
}

export async function listSessionGitBranches(sessionId: string): Promise<GitBranchListResult> {
  return fetchApiJson<GitBranchListResult>(`/api/sessions/${sessionId}/git/branches`)
}

export async function listWorkspaceGitBranches(): Promise<GitBranchListResult> {
  return fetchApiJson<GitBranchListResult>('/api/workspace/git/branches')
}

export async function listSessionGitWorktrees(sessionId: string): Promise<GitWorktreeListResult> {
  return fetchApiJson<GitWorktreeListResult>(`/api/sessions/${sessionId}/git/worktrees`)
}

export async function listWorkspaceGitWorktrees(): Promise<GitWorktreeListResult> {
  return fetchApiJson<GitWorktreeListResult>('/api/workspace/git/worktrees')
}

export async function checkoutSessionGitBranch(
  sessionId: string,
  payload: {
    name: string
    kind: GitBranchKind
  }
): Promise<GitMutationResult> {
  return fetchApiJson<GitMutationResult>(`/api/sessions/${sessionId}/git/checkout`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  })
}

export async function createSessionGitBranch(
  sessionId: string,
  payload: {
    name: string
  }
): Promise<GitMutationResult> {
  return fetchApiJson<GitMutationResult>(`/api/sessions/${sessionId}/git/branches`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  })
}

export async function commitSessionGitChanges(
  sessionId: string,
  payload: GitCommitPayload
): Promise<GitMutationResult> {
  return fetchApiJson<GitMutationResult>(`/api/sessions/${sessionId}/git/commit`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  })
}

export async function pushSessionGitBranch(
  sessionId: string,
  payload: GitPushPayload = {}
): Promise<GitMutationResult> {
  return fetchApiJson<GitMutationResult>(`/api/sessions/${sessionId}/git/push`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  })
}

export async function syncSessionGitBranch(sessionId: string): Promise<GitMutationResult> {
  return fetchApiJson<GitMutationResult>(`/api/sessions/${sessionId}/git/sync`, {
    method: 'POST'
  })
}
