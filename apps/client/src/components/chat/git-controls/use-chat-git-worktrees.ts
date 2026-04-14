import { useMemo, useState } from 'react'
import useSWR from 'swr'

import type { GitWorktreeListResult } from '@vibe-forge/types'

import { listSessionGitWorktrees } from '#~/api'
import { getGitWorktreeViewState } from './git-worktree-utils'

export function useChatGitWorktrees(input: {
  currentBranch?: string | null
  enabled: boolean
  repositoryRoot?: string
  sessionId: string
}) {
  const [worktreeMenuOpen, setWorktreeMenuOpen] = useState(false)
  const { data: worktreeData, mutate: mutateWorktreeData } = useSWR<GitWorktreeListResult>(
    input.enabled ? ['session-git-worktrees', input.sessionId] : null,
    () => listSessionGitWorktrees(input.sessionId),
    { revalidateOnFocus: false }
  )
  const viewState = useMemo(
    () =>
      getGitWorktreeViewState({
        currentBranch: input.currentBranch,
        enabled: input.enabled,
        repositoryRoot: input.repositoryRoot,
        worktrees: worktreeData?.worktrees
      }),
    [input.currentBranch, input.enabled, input.repositoryRoot, worktreeData?.worktrees]
  )

  return {
    mutateWorktreeData,
    showWorktreeButton: viewState.showWorktreeButton,
    worktreeMenuOpen,
    worktrees: viewState.worktrees,
    setWorktreeMenuOpen
  }
}
