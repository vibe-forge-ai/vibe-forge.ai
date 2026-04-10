import type { GitBranchKind, GitBranchListResult, GitPushPayload, GitRepositoryState } from '@vibe-forge/types'

import { conflict, notFound } from '#~/utils/http.js'

import { assertBranchName } from './commit'
import {
  ensureRepositoryContext,
  getBranchListForRepository,
  getSessionGitStateInternal,
  pickDefaultRemote
} from './repository'
import { resolveGitErrorMessage, runGit } from './runner'

export { commitSessionGitChanges } from './commit'

export const getSessionGitState = async (sessionId: string): Promise<GitRepositoryState> => {
  return getSessionGitStateInternal(sessionId)
}

export const listSessionGitBranches = async (sessionId: string): Promise<GitBranchListResult> => {
  const repo = await ensureRepositoryContext(sessionId)
  const { status, branches } = await getBranchListForRepository(repo.repositoryRoot)

  return {
    currentBranch: status.currentBranch,
    branches
  }
}

export const checkoutSessionGitBranch = async (
  sessionId: string,
  input: {
    name: string
    kind: GitBranchKind
  }
): Promise<GitRepositoryState> => {
  const repo = await ensureRepositoryContext(sessionId)
  const { status, branches } = await getBranchListForRepository(repo.repositoryRoot)
  const target = branches.find(branch => branch.kind === input.kind && branch.name === input.name)
  if (target == null) {
    throw notFound('Git branch not found', input, 'git_branch_not_found')
  }

  try {
    if (target.kind === 'local') {
      if (target.name !== status.currentBranch) {
        await runGit(['checkout', target.name], repo.repositoryRoot)
      }
    } else {
      const localBranch = branches.find(branch => branch.kind === 'local' && branch.localName === target.localName)
      if (localBranch != null) {
        await runGit(['checkout', localBranch.name], repo.repositoryRoot)
      } else {
        await runGit(['checkout', '--track', target.name], repo.repositoryRoot)
      }
    }
  } catch (error) {
    throw conflict(
      resolveGitErrorMessage(error, 'Failed to switch git branch'),
      { ...input, cwd: repo.repositoryRoot },
      'git_branch_checkout_failed'
    )
  }

  return getSessionGitStateInternal(sessionId)
}

export const createSessionGitBranch = async (sessionId: string, branchName: string): Promise<GitRepositoryState> => {
  const repo = await ensureRepositoryContext(sessionId)
  const name = await assertBranchName(branchName, repo.repositoryRoot)
  const { branches } = await getBranchListForRepository(repo.repositoryRoot)

  if (branches.some(branch => branch.localName === name || branch.name === name)) {
    throw conflict('Git branch already exists', { branchName: name }, 'git_branch_exists')
  }

  try {
    await runGit(['checkout', '-b', name], repo.repositoryRoot)
  } catch (error) {
    throw conflict(
      resolveGitErrorMessage(error, 'Failed to create git branch'),
      { branchName: name, cwd: repo.repositoryRoot },
      'git_branch_create_failed'
    )
  }

  return getSessionGitStateInternal(sessionId)
}

export const pushSessionGitBranch = async (
  sessionId: string,
  input: GitPushPayload = {}
): Promise<GitRepositoryState> => {
  const repo = await ensureRepositoryContext(sessionId)
  const status = await getSessionGitStateInternal(sessionId)
  const currentBranch = status.currentBranch
  const force = input.force === true

  if (currentBranch == null || currentBranch === '') {
    throw conflict('Detached HEAD cannot be pushed directly', { sessionId }, 'git_detached_head')
  }

  try {
    const pushArgs = ['push']
    if (force) {
      pushArgs.push('--force-with-lease')
    }

    if (status.upstream != null && status.upstream !== '') {
      await runGit(pushArgs, repo.repositoryRoot)
    } else {
      const remote = pickDefaultRemote(status.remotes ?? [])
      if (remote == null) {
        throw conflict('No git remote is configured', { sessionId }, 'git_remote_missing')
      }
      await runGit([...pushArgs, '--set-upstream', remote, currentBranch], repo.repositoryRoot)
    }
  } catch (error) {
    if (error instanceof Error && 'status' in error) {
      throw error
    }
    throw conflict(
      resolveGitErrorMessage(error, 'Failed to push git branch'),
      { cwd: repo.repositoryRoot, currentBranch },
      'git_push_failed'
    )
  }

  return getSessionGitStateInternal(sessionId)
}

export const syncSessionGitBranch = async (sessionId: string): Promise<GitRepositoryState> => {
  const repo = await ensureRepositoryContext(sessionId)
  const status = await getSessionGitStateInternal(sessionId)
  const currentBranch = status.currentBranch

  if (currentBranch == null || currentBranch === '') {
    throw conflict('Detached HEAD cannot be synced directly', { sessionId }, 'git_detached_head')
  }

  try {
    if (status.upstream != null && status.upstream !== '') {
      await runGit(['pull', '--rebase', '--autostash'], repo.repositoryRoot)
    } else {
      const remote = pickDefaultRemote(status.remotes ?? [])
      if (remote == null) {
        throw conflict('No git remote is configured', { sessionId }, 'git_remote_missing')
      }
      await runGit(['pull', '--rebase', '--autostash', remote, currentBranch], repo.repositoryRoot)
    }
  } catch (error) {
    if (error instanceof Error && 'status' in error) {
      throw error
    }
    throw conflict(
      resolveGitErrorMessage(error, 'Failed to sync git branch'),
      { cwd: repo.repositoryRoot, currentBranch },
      'git_sync_failed'
    )
  }

  return getSessionGitStateInternal(sessionId)
}
