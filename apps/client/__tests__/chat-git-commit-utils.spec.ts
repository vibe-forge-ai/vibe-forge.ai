import { describe, expect, it } from 'vitest'

import type { GitRepositoryState } from '@vibe-forge/types'

import {
  canGitCommitAndPush,
  canSubmitGitCommit,
  getGitCommitBlockedReason,
  getGitCommitSummary
} from '#~/components/chat/git-controls/git-commit-utils'

const createRepoState = (overrides: Partial<GitRepositoryState> = {}): GitRepositoryState => ({
  available: true,
  cwd: '/tmp/repo',
  currentBranch: 'feature/header',
  upstream: 'origin/feature/header',
  ahead: 0,
  behind: 0,
  hasChanges: true,
  hasStagedChanges: true,
  hasUnstagedChanges: true,
  remotes: ['origin'],
  stagedSummary: {
    changedFiles: 1,
    additions: 2,
    deletions: 1
  },
  workingTreeSummary: {
    changedFiles: 3,
    additions: 8,
    deletions: 2
  },
  headCommit: {
    hash: 'abcdef0123456789',
    shortHash: 'abcdef0',
    subject: 'feat: previous'
  },
  ...overrides
})

describe('chat git commit utils', () => {
  it('switches summary based on whether unstaged changes are included', () => {
    const repoState = createRepoState()

    expect(getGitCommitSummary(repoState, false)).toEqual({
      changedFiles: 1,
      additions: 2,
      deletions: 1
    })
    expect(getGitCommitSummary(repoState, true)).toEqual({
      changedFiles: 3,
      additions: 8,
      deletions: 2
    })
  })

  it('requires staged changes when unstaged changes are excluded', () => {
    const repoState = createRepoState({
      hasStagedChanges: false
    })

    expect(canSubmitGitCommit(repoState, {
      includeUnstagedChanges: false,
      amend: false,
      commitMessage: 'feat: staged only'
    })).toBe(false)
    expect(canSubmitGitCommit(repoState, {
      includeUnstagedChanges: true,
      amend: false,
      commitMessage: 'feat: all changes'
    })).toBe(true)
  })

  it('requires a commit message for non-amend commits', () => {
    const repoState = createRepoState({
      hasChanges: true,
      hasStagedChanges: true
    })

    expect(canSubmitGitCommit(repoState, {
      includeUnstagedChanges: true,
      amend: false,
      commitMessage: ''
    })).toBe(false)

    expect(getGitCommitBlockedReason(repoState, {
      includeUnstagedChanges: true,
      amend: false,
      commitMessage: ''
    })).toBe('message-required')
  })

  it('allows amend only when a previous commit exists', () => {
    expect(canSubmitGitCommit(
      createRepoState({
        headCommit: null
      }),
      {
        includeUnstagedChanges: false,
        amend: true,
        commitMessage: ''
      }
    )).toBe(false)

    expect(canSubmitGitCommit(createRepoState(), {
      includeUnstagedChanges: false,
      amend: true,
      commitMessage: 'feat: rewrite subject'
    })).toBe(true)
  })

  it('blocks no-op amend until there are changes or a new message', () => {
    const repoState = createRepoState({
      hasChanges: false,
      hasStagedChanges: false,
      hasUnstagedChanges: false
    })

    expect(getGitCommitBlockedReason(repoState, {
      includeUnstagedChanges: false,
      amend: true,
      commitMessage: ''
    })).toBe('no-staged-changes')

    expect(getGitCommitBlockedReason(repoState, {
      includeUnstagedChanges: false,
      amend: true,
      commitMessage: 'feat: retitle commit'
    })).toBeNull()
  })

  it('exposes commit and push only when pushing is possible', () => {
    expect(canGitCommitAndPush(createRepoState())).toBe(true)
    expect(canGitCommitAndPush(createRepoState({
      currentBranch: null,
      upstream: null,
      remotes: []
    }))).toBe(false)
  })
})
