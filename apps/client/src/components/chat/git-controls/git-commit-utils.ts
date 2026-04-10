import type { GitChangeSummary, GitRepositoryState } from '@vibe-forge/types'

import { isGitOperationDisabled } from './git-operation-utils'

export type GitCommitNextStep = 'commit' | 'commit-and-push'
export type GitCommitBlockedReason =
  | 'amend-unavailable'
  | 'message-required'
  | 'no-changes'
  | 'no-staged-changes'
  | null

const EMPTY_GIT_CHANGE_SUMMARY: GitChangeSummary = {
  changedFiles: 0,
  additions: 0,
  deletions: 0
}

export const getGitCommitSummary = (
  repoState: GitRepositoryState,
  includeUnstagedChanges: boolean
): GitChangeSummary => {
  return includeUnstagedChanges
    ? repoState.workingTreeSummary ?? EMPTY_GIT_CHANGE_SUMMARY
    : repoState.stagedSummary ?? EMPTY_GIT_CHANGE_SUMMARY
}

export const getGitCommitBlockedReason = (
  repoState: GitRepositoryState,
  options: {
    includeUnstagedChanges: boolean
    amend: boolean
    commitMessage: string
  }
): GitCommitBlockedReason => {
  const hasCommitChanges = options.includeUnstagedChanges
    ? repoState.hasChanges === true
    : repoState.hasStagedChanges === true
  const hasMessage = options.commitMessage.trim() !== ''

  if (options.amend && repoState.headCommit == null) {
    return 'amend-unavailable'
  }

  if (options.amend) {
    return hasCommitChanges || hasMessage
      ? null
      : options.includeUnstagedChanges
      ? 'no-changes'
      : 'no-staged-changes'
  }

  if (!hasCommitChanges) {
    return options.includeUnstagedChanges
      ? 'no-changes'
      : 'no-staged-changes'
  }

  return hasMessage ? null : 'message-required'
}

export const canSubmitGitCommit = (
  repoState: GitRepositoryState,
  options: {
    includeUnstagedChanges: boolean
    amend: boolean
    commitMessage: string
  }
) => {
  return getGitCommitBlockedReason(repoState, options) == null
}

export const canGitCommitAndPush = (repoState: GitRepositoryState) => {
  return !isGitOperationDisabled(repoState, 'push')
}

export const isGitCommitMessageRequired = (amend: boolean) => {
  return !amend
}
