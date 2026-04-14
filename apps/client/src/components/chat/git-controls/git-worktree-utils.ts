import type { GitWorktreeSummary } from '@vibe-forge/types'

const sortGitWorktrees = (worktrees: GitWorktreeSummary[]) => {
  return [...worktrees].sort((left, right) => {
    if (left.isCurrent !== right.isCurrent) {
      return left.isCurrent ? -1 : 1
    }

    return left.path.localeCompare(right.path)
  })
}

const getCurrentWorktreeFallback = (repositoryRoot?: string, currentBranch?: string | null): GitWorktreeSummary[] => {
  const path = repositoryRoot?.trim() ?? ''
  if (path === '') {
    return []
  }

  const branchName = currentBranch?.trim() || null
  return [{
    path,
    branchName,
    isCurrent: true,
    isDetached: branchName == null
  }]
}

export const getGitWorktreeViewState = (input: {
  currentBranch?: string | null
  enabled: boolean
  repositoryRoot?: string
  worktrees?: GitWorktreeSummary[]
}) => {
  if (!input.enabled) {
    return {
      showWorktreeButton: false,
      worktrees: []
    }
  }

  const worktrees = input.worktrees != null && input.worktrees.length > 0
    ? sortGitWorktrees(input.worktrees)
    : getCurrentWorktreeFallback(input.repositoryRoot, input.currentBranch)

  return {
    showWorktreeButton: true,
    worktrees
  }
}
