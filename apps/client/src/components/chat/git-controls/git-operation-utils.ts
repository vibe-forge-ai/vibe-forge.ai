import type { GitRepositoryState } from '@vibe-forge/types'

export type GitOperationKind = 'commit' | 'push' | 'sync'
export type GitPushBlockedReason = 'behind-upstream' | 'push-unavailable' | null

const hasUpstream = (repoState: GitRepositoryState) => repoState.upstream != null && repoState.upstream.trim() !== ''

const hasRemote = (repoState: GitRepositoryState) => hasUpstream(repoState) || (repoState.remotes?.length ?? 0) > 0

const hasBranch = (repoState: GitRepositoryState) =>
  repoState.currentBranch != null && repoState.currentBranch.trim() !== ''

export const isGitOperationDisabled = (
  repoState: GitRepositoryState,
  kind: GitOperationKind
) => {
  switch (kind) {
    case 'commit':
      return repoState.hasChanges !== true
    case 'push':
    case 'sync':
      return !hasBranch(repoState) || !hasRemote(repoState)
  }
}

export const getGitPushBlockedReason = (
  repoState: GitRepositoryState,
  forcePush: boolean
): GitPushBlockedReason => {
  if (isGitOperationDisabled(repoState, 'push')) {
    return 'push-unavailable'
  }

  if ((repoState.behind ?? 0) > 0 && !forcePush) {
    return 'behind-upstream'
  }

  return null
}

export const getGitControlState = (
  repoState: GitRepositoryState | undefined,
  forcePush: boolean,
  labels: {
    detachedHead: string
    pushNeedsSyncOrForce: string
    pushUnavailable: string
  }
) => {
  const currentBranchName = repoState?.available === true
    ? repoState.currentBranch?.trim() ?? ''
    : ''
  const currentBranchLabel = currentBranchName !== ''
    ? currentBranchName
    : labels.detachedHead
  const pushBlockedReason = repoState?.available === true
    ? getGitPushBlockedReason(repoState, forcePush)
    : 'push-unavailable'

  return {
    currentBranchLabel,
    pushBlockedReason,
    pushBlockedMessage: pushBlockedReason === 'behind-upstream'
      ? labels.pushNeedsSyncOrForce
      : pushBlockedReason == null
      ? ''
      : labels.pushUnavailable
  }
}

export const getPrimaryGitOperationKind = (
  repoState: GitRepositoryState
): GitOperationKind | null => {
  if (repoState.hasChanges === true) {
    return 'commit'
  }

  if ((repoState.behind ?? 0) > 0 && !isGitOperationDisabled(repoState, 'sync')) {
    return 'sync'
  }

  if (
    ((repoState.ahead ?? 0) > 0 || !hasUpstream(repoState)) &&
    !isGitOperationDisabled(repoState, 'push')
  ) {
    return 'push'
  }

  if (!isGitOperationDisabled(repoState, 'sync')) {
    return 'sync'
  }

  if (!isGitOperationDisabled(repoState, 'push')) {
    return 'push'
  }

  return null
}
