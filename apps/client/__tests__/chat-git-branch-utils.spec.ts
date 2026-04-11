import { describe, expect, it } from 'vitest'

import type { GitBranchSummary } from '@vibe-forge/types'

import {
  filterGitBranches,
  formatGitWorktreePathLabel,
  getGitBranchCheckoutBlockedPath,
  getGitBranchViewState,
  hasExactGitBranchMatch,
  isGitBranchCheckedOutInOtherWorktree
} from '#~/components/chat/git-controls/git-branch-utils'

describe('chat git branch utils', () => {
  const branches: GitBranchSummary[] = [
    {
      name: 'main',
      kind: 'local',
      localName: 'main',
      isCurrent: true
    },
    {
      name: 'feature/chat-header',
      kind: 'local',
      localName: 'feature/chat-header',
      worktreePath: '/Users/yijie/.codex/worktrees/3d03/vibe-forge.ai',
      isCurrent: false
    },
    {
      name: 'origin/main',
      kind: 'remote',
      localName: 'main',
      remoteName: 'origin',
      isCurrent: false
    },
    {
      name: 'origin/release/v1',
      kind: 'remote',
      localName: 'release/v1',
      remoteName: 'origin',
      isCurrent: false
    }
  ]

  it('filters branches by local and remote names', () => {
    expect(filterGitBranches(branches, 'release')).toEqual([
      {
        name: 'origin/release/v1',
        kind: 'remote',
        localName: 'release/v1',
        remoteName: 'origin',
        isCurrent: false
      }
    ])

    expect(filterGitBranches(branches, 'origin/main')).toEqual([
      {
        name: 'origin/main',
        kind: 'remote',
        localName: 'main',
        remoteName: 'origin',
        isCurrent: false
      }
    ])

    expect(filterGitBranches(branches, 'chat-header')).toEqual([
      {
        name: 'feature/chat-header',
        kind: 'local',
        localName: 'feature/chat-header',
        worktreePath: '/Users/yijie/.codex/worktrees/3d03/vibe-forge.ai',
        isCurrent: false
      }
    ])
  })

  it('treats matching local or remote refs as exact matches', () => {
    expect(hasExactGitBranchMatch(branches, 'main')).toBe(true)
    expect(hasExactGitBranchMatch(branches, 'origin/main')).toBe(true)
    expect(hasExactGitBranchMatch(branches, 'feature/new-panel')).toBe(false)
  })

  it('detects branches that are checked out in another worktree', () => {
    expect(isGitBranchCheckedOutInOtherWorktree(
      {
        name: 'feature/chat-header',
        kind: 'local',
        localName: 'feature/chat-header',
        worktreePath: '/Users/yijie/.codex/worktrees/3d03/vibe-forge.ai',
        isCurrent: false
      },
      '/Users/yijie/codes/vibe-forge.ai'
    )).toBe(true)

    expect(getGitBranchCheckoutBlockedPath(
      {
        name: 'origin/feature/chat-header',
        kind: 'remote',
        localName: 'feature/chat-header',
        remoteName: 'origin',
        isCurrent: false
      },
      branches,
      '/Users/yijie/codes/vibe-forge.ai'
    )).toBe('/Users/yijie/.codex/worktrees/3d03/vibe-forge.ai')
  })

  it('formats worktree paths for compact display', () => {
    expect(formatGitWorktreePathLabel('/Users/yijie/.codex/worktrees/3d03/vibe-forge.ai')).toBe('3d03/vibe-forge.ai')
  })

  it('hides branches that are occupied by another worktree from the switcher view', () => {
    const allVisibleBranches: GitBranchSummary[] = [
      {
        name: 'main',
        kind: 'local',
        localName: 'main',
        worktreePath: '/Users/yijie/codes/vibe-forge.ai',
        isCurrent: false
      },
      {
        name: 'feature/panel',
        kind: 'local',
        localName: 'feature/panel',
        isCurrent: true
      },
      {
        name: 'origin/main',
        kind: 'remote',
        localName: 'main',
        remoteName: 'origin',
        isCurrent: false
      },
      {
        name: 'origin/release/v1',
        kind: 'remote',
        localName: 'release/v1',
        remoteName: 'origin',
        isCurrent: false
      }
    ]

    const { availableLocalBranches, hasResults, remoteBranches } = getGitBranchViewState(
      allVisibleBranches,
      allVisibleBranches,
      '/Users/yijie/.codex/worktrees/3d03/vibe-forge.ai'
    )

    expect(availableLocalBranches.map(branch => branch.name)).toEqual(['feature/panel'])
    expect(hasResults).toBe(true)
    expect(remoteBranches.map(branch => branch.name)).toEqual(['origin/release/v1'])

    const remoteOnlyQueryBranches = allVisibleBranches.filter(branch => branch.name === 'origin/main')
    expect(
      getGitBranchViewState(
        remoteOnlyQueryBranches,
        allVisibleBranches,
        '/Users/yijie/.codex/worktrees/3d03/vibe-forge.ai'
      )
    ).toEqual({
      availableLocalBranches: [],
      hasResults: false,
      remoteBranches: []
    })
  })
})
