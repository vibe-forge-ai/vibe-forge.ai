import { access } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'

import type { WSEvent } from '@vibe-forge/core'
import type { GitAvailabilityReason, GitBranchSummary, GitRepositoryState, SessionInfo } from '@vibe-forge/types'

import { getDb } from '#~/db/index.js'
import { getWorkspaceFolder } from '#~/services/config/index.js'
import { conflict, notFound } from '#~/utils/http.js'

import type { ParsedGitStatus } from './parsers'

import { parseGitBranches, parseGitStatus } from './parsers'
import { isGitMissingError, isNotRepositoryError, resolveGitErrorMessage, runGit } from './runner'

interface GitRepositoryContext {
  available: boolean
  cwd: string
  repositoryRoot?: string
  reason?: GitAvailabilityReason
}

export interface AvailableGitRepositoryContext extends GitRepositoryContext {
  available: true
  repositoryRoot: string
}

const resolveSessionGitCwd = async (sessionId: string) => {
  const db = getDb()
  const session = db.getSession(sessionId)
  if (session == null) {
    throw notFound('Session not found', { sessionId }, 'session_not_found')
  }

  const workspaceFolder = getWorkspaceFolder()
  const events = db.getMessages(sessionId) as WSEvent[]
  let cwd = workspaceFolder

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event?.type !== 'session_info') {
      continue
    }

    const info = event.info as SessionInfo | null | undefined
    if (info == null || info.type === 'summary' || typeof info.cwd !== 'string' || info.cwd.trim() === '') {
      continue
    }

    cwd = info.cwd.trim()
    break
  }

  return isAbsolute(cwd) ? cwd : resolve(workspaceFolder, cwd)
}

const resolveRepositoryContext = async (sessionId: string): Promise<GitRepositoryContext> => {
  const cwd = await resolveSessionGitCwd(sessionId)

  try {
    await access(cwd)
  } catch {
    return {
      available: false,
      cwd,
      reason: 'cwd_missing'
    }
  }

  try {
    const { stdout } = await runGit(['rev-parse', '--show-toplevel'], cwd)
    return {
      available: true,
      cwd,
      repositoryRoot: stdout
    }
  } catch (error) {
    if (isGitMissingError(error)) {
      return {
        available: false,
        cwd,
        reason: 'git_not_installed'
      }
    }

    if (isNotRepositoryError(error)) {
      return {
        available: false,
        cwd,
        reason: 'not_repository'
      }
    }

    throw conflict(
      resolveGitErrorMessage(error, 'Failed to inspect git repository'),
      { sessionId, cwd },
      'git_repository_inspect_failed'
    )
  }
}

export const ensureRepositoryContext = async (sessionId: string): Promise<AvailableGitRepositoryContext> => {
  const repo = await resolveRepositoryContext(sessionId)
  if (!repo.available || repo.repositoryRoot == null) {
    throw conflict('Git repository is not available for this session', repo, 'git_repository_unavailable')
  }
  return repo as AvailableGitRepositoryContext
}

export const listRepositoryRemotes = async (repositoryRoot: string) => {
  const { stdout } = await runGit(['remote'], repositoryRoot)
  return stdout.split(/\r?\n/).map(item => item.trim()).filter(Boolean)
}

export const getRepositoryStatus = async (repositoryRoot: string): Promise<ParsedGitStatus> => {
  const { stdout } = await runGit(['status', '--porcelain=v2', '--branch'], repositoryRoot)
  return parseGitStatus(stdout)
}

export const getRepositoryBranches = async (repositoryRoot: string, currentBranch: string | null) => {
  const { stdout } = await runGit(
    ['for-each-ref', '--format=%(refname:short)\t%(refname)', 'refs/heads', 'refs/remotes'],
    repositoryRoot
  )
  return parseGitBranches(stdout, currentBranch)
}

export const pickDefaultRemote = (remotes: string[]) => {
  if (remotes.includes('origin')) {
    return 'origin'
  }
  return remotes[0] ?? null
}

export const getSessionGitStateInternal = async (sessionId: string): Promise<GitRepositoryState> => {
  const repo = await resolveRepositoryContext(sessionId)
  if (!repo.available || repo.repositoryRoot == null) {
    return {
      available: false,
      cwd: repo.cwd,
      reason: repo.reason
    }
  }

  const [status, remotes] = await Promise.all([
    getRepositoryStatus(repo.repositoryRoot),
    listRepositoryRemotes(repo.repositoryRoot)
  ])

  return {
    available: true,
    cwd: repo.cwd,
    repositoryRoot: repo.repositoryRoot,
    currentBranch: status.currentBranch,
    upstream: status.upstream,
    ahead: status.ahead,
    behind: status.behind,
    hasChanges: status.hasChanges,
    hasStagedChanges: status.hasStagedChanges,
    hasUnstagedChanges: status.hasUnstagedChanges,
    hasUntrackedChanges: status.hasUntrackedChanges,
    remotes
  }
}

export const getBranchListForRepository = async (repositoryRoot: string): Promise<{
  status: ParsedGitStatus
  branches: GitBranchSummary[]
}> => {
  const status = await getRepositoryStatus(repositoryRoot)
  const branches = await getRepositoryBranches(repositoryRoot, status.currentBranch)

  return {
    status,
    branches
  }
}
