import { describe, expect, it } from 'vitest'

import type { GitBranchSummary } from '@vibe-forge/types'

import { filterGitBranches, hasExactGitBranchMatch } from '#~/components/chat/git-controls/git-branch-utils'

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
  })

  it('treats matching local or remote refs as exact matches', () => {
    expect(hasExactGitBranchMatch(branches, 'main')).toBe(true)
    expect(hasExactGitBranchMatch(branches, 'origin/main')).toBe(true)
    expect(hasExactGitBranchMatch(branches, 'feature/new-panel')).toBe(false)
  })
})
