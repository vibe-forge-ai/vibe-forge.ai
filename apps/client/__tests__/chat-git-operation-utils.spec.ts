import { describe, expect, it } from 'vitest'

import type { GitRepositoryState } from '@vibe-forge/types'

import { getPrimaryGitOperationKind, isGitOperationDisabled } from '#~/components/chat/git-controls/git-operation-utils'

const createRepoState = (overrides: Partial<GitRepositoryState> = {}): GitRepositoryState => ({
  available: true,
  cwd: '/tmp/repo',
  currentBranch: 'feature/header',
  upstream: 'origin/feature/header',
  ahead: 0,
  behind: 0,
  hasChanges: false,
  remotes: ['origin'],
  ...overrides
})

describe('chat git operation utils', () => {
  it('prefers commit when the repository has uncommitted changes', () => {
    expect(getPrimaryGitOperationKind(createRepoState({ hasChanges: true }))).toBe('commit')
  })

  it('prefers sync when the branch is behind upstream', () => {
    expect(getPrimaryGitOperationKind(createRepoState({ behind: 2 }))).toBe('sync')
  })

  it('prefers push when the branch is ahead of upstream', () => {
    expect(getPrimaryGitOperationKind(createRepoState({ ahead: 3 }))).toBe('push')
  })

  it('prefers push when a remote exists but upstream is not configured yet', () => {
    expect(getPrimaryGitOperationKind(createRepoState({ upstream: null }))).toBe('push')
  })

  it('falls back to sync when the branch is clean and already tracks upstream', () => {
    expect(getPrimaryGitOperationKind(createRepoState())).toBe('sync')
  })

  it('disables remote operations when the branch cannot be synced or pushed', () => {
    const detached = createRepoState({
      currentBranch: null,
      upstream: null,
      remotes: []
    })

    expect(isGitOperationDisabled(detached, 'push')).toBe(true)
    expect(isGitOperationDisabled(detached, 'sync')).toBe(true)
    expect(getPrimaryGitOperationKind(detached)).toBeNull()
  })
})
