/* eslint-disable max-lines */

import type {
  GitBranchKind,
  GitBranchListResult,
  GitPushPayload,
  GitRepositoryState,
  GitWorktreeListResult
} from '@vibe-forge/types'

import { conflict, notFound } from '#~/utils/http.js'
import { getWorkspaceFolder } from '#~/services/config/index.js'
import { resolveSessionWorkspace } from '#~/services/session/workspace.js'

import { assertBranchName } from './commit'
import {
  ensureRepositoryContext,
  getBranchListForRepository,
  getRepositoryWorktrees,
  getSessionGitStateInternal,
  getWorkspaceGitStateInternal,
  pickDefaultRemote
} from './repository'
import { resolveGitErrorMessage, runGit } from './runner'
import { getBlockedGitWorktreePath } from './worktree'

export { commitSessionGitChanges } from './commit'

interface GitSyncRemoteTarget {
  branch: string
  remote: string
}

const looksLikeGitCommitRef = (value: string) => /^[0-9a-f]{7,40}$/i.test(value)

const resolveFallbackSyncTarget = (
  baseRef: string | undefined,
  remotes: string[],
  defaultRemote: string
): GitSyncRemoteTarget | null => {
  const normalizedBaseRef = baseRef?.trim()
  if (
    normalizedBaseRef == null
    || normalizedBaseRef === ''
    || normalizedBaseRef === 'HEAD'
    || looksLikeGitCommitRef(normalizedBaseRef)
  ) {
    return null
  }

  if (normalizedBaseRef.startsWith('refs/heads/')) {
    const branch = normalizedBaseRef.slice('refs/heads/'.length).trim()
    return branch === '' ? null : { remote: defaultRemote, branch }
  }

  if (normalizedBaseRef.startsWith('refs/remotes/')) {
    const remoteRef = normalizedBaseRef.slice('refs/remotes/'.length)
    const [remote, ...branchParts] = remoteRef.split('/')
    const branch = branchParts.join('/').trim()
    if (remote === '' || branch === '' || !remotes.includes(remote)) {
      return null
    }
    return {
      remote,
      branch
    }
  }

  const explicitRemote = remotes.find(
    remote => normalizedBaseRef.startsWith(`${remote}/`) && normalizedBaseRef.length > remote.length + 1
  )
  if (explicitRemote != null) {
    return {
      remote: explicitRemote,
      branch: normalizedBaseRef.slice(explicitRemote.length + 1)
    }
  }

  return {
    remote: defaultRemote,
    branch: normalizedBaseRef
  }
}

const doesRemoteBranchExist = async (repositoryRoot: string, remote: string, branch: string) => {
  const { stdout } = await runGit(
    ['ls-remote', '--heads', remote, `refs/heads/${branch}`],
    repositoryRoot
  )
  return stdout.trim() !== ''
}

const resolveSyncRemoteTarget = async (
  sessionId: string,
  repositoryRoot: string,
  currentBranch: string,
  remotes: string[]
): Promise<GitSyncRemoteTarget> => {
  const remote = pickDefaultRemote(remotes)
  if (remote == null) {
    throw conflict('No git remote is configured', { sessionId }, 'git_remote_missing')
  }

  if (await doesRemoteBranchExist(repositoryRoot, remote, currentBranch)) {
    return {
      remote,
      branch: currentBranch
    }
  }

  const workspace = await resolveSessionWorkspace(sessionId)
  const fallbackTarget = resolveFallbackSyncTarget(workspace.baseRef, remotes, remote)
  if (
    fallbackTarget != null
    && (fallbackTarget.remote !== remote || fallbackTarget.branch !== currentBranch)
    && await doesRemoteBranchExist(repositoryRoot, fallbackTarget.remote, fallbackTarget.branch)
  ) {
    return fallbackTarget
  }

  throw conflict(
    'No remote branch is available to sync this session branch',
    {
      sessionId,
      currentBranch,
      remote,
      baseRef: workspace.baseRef
    },
    'git_remote_branch_missing'
  )
}

export const getSessionGitState = async (sessionId: string): Promise<GitRepositoryState> => {
  return getSessionGitStateInternal(sessionId)
}

export const getWorkspaceGitState = async (): Promise<GitRepositoryState> => {
  return await getWorkspaceGitStateInternal(getWorkspaceFolder())
}

export const listSessionGitBranches = async (sessionId: string): Promise<GitBranchListResult> => {
  const repo = await ensureRepositoryContext(sessionId)
  const { status, branches } = await getBranchListForRepository(repo.repositoryRoot)

  return {
    currentBranch: status.currentBranch,
    branches
  }
}

export const listWorkspaceGitBranches = async (): Promise<GitBranchListResult> => {
  const repo = await getWorkspaceGitState()
  if (!repo.available || repo.repositoryRoot == null) {
    return {
      currentBranch: repo.currentBranch ?? null,
      branches: []
    }
  }

  const { status, branches } = await getBranchListForRepository(repo.repositoryRoot)

  return {
    currentBranch: status.currentBranch,
    branches
  }
}

export const listSessionGitWorktrees = async (sessionId: string): Promise<GitWorktreeListResult> => {
  const repo = await ensureRepositoryContext(sessionId)

  return {
    worktrees: await getRepositoryWorktrees(repo.repositoryRoot)
  }
}

export const listWorkspaceGitWorktrees = async (): Promise<GitWorktreeListResult> => {
  const repo = await getWorkspaceGitState()
  if (!repo.available || repo.repositoryRoot == null) {
    return {
      worktrees: []
    }
  }

  return {
    worktrees: await getRepositoryWorktrees(repo.repositoryRoot)
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

  const blockedWorktreePath = getBlockedGitWorktreePath(target, branches, repo.repositoryRoot)
  if (blockedWorktreePath != null) {
    throw conflict(
      `Git branch ${target.localName} is already checked out in another worktree`,
      {
        ...input,
        branchName: target.localName,
        worktreePath: blockedWorktreePath
      },
      'git_branch_checked_out_in_other_worktree'
    )
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
      const target = await resolveSyncRemoteTarget(
        sessionId,
        repo.repositoryRoot,
        currentBranch,
        status.remotes ?? []
      )
      await runGit(['pull', '--rebase', '--autostash', target.remote, target.branch], repo.repositoryRoot)
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
