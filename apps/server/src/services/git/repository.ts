import { access } from 'node:fs/promises'

import type {
  GitAvailabilityReason,
  GitBranchSummary,
  GitRepositoryState,
  GitWorktreeSummary
} from '@vibe-forge/types'

import { resolveSessionWorkspaceFolder } from '#~/services/session/workspace.js'
import { conflict } from '#~/utils/http.js'

import type { ParsedGitStatus } from './parsers'

import { parseGitBranches, parseGitStatus } from './parsers'
import { isGitMissingError, isNotRepositoryError, resolveGitErrorMessage, runGit } from './runner'
import { getHeadCommitSummary, getRepositoryChangeSummaries } from './summary'
import { parseGitWorktrees } from './worktree-parser'

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
  return await resolveSessionWorkspaceFolder(sessionId)
}

const resolveRepositoryContextForCwd = async (
  cwd: string,
  errorMeta: Record<string, unknown>
): Promise<GitRepositoryContext> => {
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
      errorMeta,
      'git_repository_inspect_failed'
    )
  }
}

const resolveRepositoryContext = async (sessionId: string): Promise<GitRepositoryContext> => {
  const cwd = await resolveSessionGitCwd(sessionId)
  return await resolveRepositoryContextForCwd(cwd, { sessionId, cwd })
}

export const ensureRepositoryContext = async (sessionId: string): Promise<AvailableGitRepositoryContext> => {
  const repo = await resolveRepositoryContext(sessionId)
  if (!repo.available || repo.repositoryRoot == null) {
    throw conflict('Git repository is not available for this session', repo, 'git_repository_unavailable')
  }
  return repo as AvailableGitRepositoryContext
}

export const resolveRepositoryContextByWorkspaceFolder = async (
  workspaceFolder: string
): Promise<GitRepositoryContext> => {
  return await resolveRepositoryContextForCwd(workspaceFolder, { cwd: workspaceFolder })
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
    ['for-each-ref', '--format=%(refname:short)\t%(refname)\t%(worktreepath)', 'refs/heads', 'refs/remotes'],
    repositoryRoot
  )
  return parseGitBranches(stdout, currentBranch)
}

export const getRepositoryWorktrees = async (repositoryRoot: string): Promise<GitWorktreeSummary[]> => {
  const { stdout } = await runGit(['worktree', 'list', '--porcelain'], repositoryRoot)
  return parseGitWorktrees(stdout, repositoryRoot)
}

export const pickDefaultRemote = (remotes: string[]) => {
  if (remotes.includes('origin')) {
    return 'origin'
  }
  return remotes[0] ?? null
}

export const getSessionGitStateInternal = async (sessionId: string): Promise<GitRepositoryState> => {
  const repo = await resolveRepositoryContext(sessionId)
  return await getGitStateFromRepositoryContext(repo)
}

export const getGitStateFromRepositoryContext = async (
  repo: GitRepositoryContext
): Promise<GitRepositoryState> => {
  if (!repo.available || repo.repositoryRoot == null) {
    return {
      available: false,
      cwd: repo.cwd,
      reason: repo.reason
    }
  }

  const [status, remotes, summaries, headCommit] = await Promise.all([
    getRepositoryStatus(repo.repositoryRoot),
    listRepositoryRemotes(repo.repositoryRoot),
    getRepositoryChangeSummaries(repo.repositoryRoot),
    getHeadCommitSummary(repo.repositoryRoot)
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
    remotes,
    stagedSummary: summaries.stagedSummary,
    workingTreeSummary: summaries.workingTreeSummary,
    headCommit
  }
}

export const getWorkspaceGitStateInternal = async (workspaceFolder: string): Promise<GitRepositoryState> => {
  const repo = await resolveRepositoryContextByWorkspaceFolder(workspaceFolder)
  return await getGitStateFromRepositoryContext(repo)
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
