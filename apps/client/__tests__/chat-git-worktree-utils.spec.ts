import { describe, expect, it } from 'vitest'

import { getGitWorktreeViewState } from '#~/components/chat/git-controls/git-worktree-utils'

describe('chat git worktree utils', () => {
  it('shows the worktree button for any enabled git repository', () => {
    expect(getGitWorktreeViewState({
      enabled: true,
      repositoryRoot: '/workspace/repo',
      currentBranch: 'main'
    })).toEqual({
      showWorktreeButton: true,
      worktrees: [
        {
          path: '/workspace/repo',
          branchName: 'main',
          isCurrent: true,
          isDetached: false
        }
      ]
    })
  })

  it('sorts fetched worktrees with the current one first', () => {
    expect(getGitWorktreeViewState({
      enabled: true,
      repositoryRoot: '/workspace/repo',
      currentBranch: 'main',
      worktrees: [
        {
          path: '/workspace/other',
          branchName: 'feature/x',
          isCurrent: false,
          isDetached: false
        },
        {
          path: '/workspace/repo',
          branchName: 'main',
          isCurrent: true,
          isDetached: false
        }
      ]
    })).toEqual({
      showWorktreeButton: true,
      worktrees: [
        {
          path: '/workspace/repo',
          branchName: 'main',
          isCurrent: true,
          isDetached: false
        },
        {
          path: '/workspace/other',
          branchName: 'feature/x',
          isCurrent: false,
          isDetached: false
        }
      ]
    })
  })

  it('hides the worktree button when git is unavailable', () => {
    expect(getGitWorktreeViewState({
      enabled: false,
      repositoryRoot: '/workspace/repo',
      currentBranch: 'main'
    })).toEqual({
      showWorktreeButton: false,
      worktrees: []
    })
  })
})
