/* eslint-disable max-lines */

import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { env as processEnv } from 'node:process'

import type { WSEvent } from '@vibe-forge/core'
import { resolvePrimaryWorkspaceFolder } from '@vibe-forge/register/dotenv'
import type { SessionInfo } from '@vibe-forge/types'
import {
  PROJECT_WORKSPACE_FOLDER_ENV,
  addGitWorktree,
  isGitMissingError,
  isGitNotRepositoryError,
  removeGitWorktree,
  resolveGitCurrentBranch,
  resolveGitHeadRef,
  resolveGitRepositoryRoot,
  resolveProjectAiPath,
  runGitCommand
} from '@vibe-forge/utils'

import { getDb } from '#~/db/index.js'
import type {
  SessionWorkspaceCleanupPolicy,
  SessionWorkspaceKind,
  SessionWorkspaceRow
} from '#~/db/sessionWorkspaces/repo.js'
import { getWorkspaceFolder } from '#~/services/config/index.js'
import {
  normalizeOptionalWorktreeEnvironmentId,
  runConfiguredWorktreeEnvironmentScripts
} from '#~/services/worktree-environments.js'
import { conflict, notFound } from '#~/utils/http.js'

interface ProvisionSessionWorkspaceOptions {
  sourceSessionId?: string
  createWorktree?: boolean
  worktreeEnvironment?: string
}

const DEFAULT_CLEANUP_POLICY: SessionWorkspaceCleanupPolicy = 'delete_on_session_delete'

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const getSessionOrThrow = (sessionId: string) => {
  const session = getDb().getSession(sessionId)
  if (session == null) {
    throw notFound('Session not found', { sessionId }, 'session_not_found')
  }
  return session
}

const resolveRepositoryDirectoryName = (repositoryRoot: string, fallback: string) => {
  const segments = repositoryRoot
    .split(/[\\/]+/)
    .map(segment => segment.trim())
    .filter(Boolean)

  return segments.at(-1) ?? fallback
}

const resolveManagedWorktreePath = (
  workspaceFolder: string,
  sessionId: string,
  repositoryRoot: string
) => {
  const primaryWorkspaceFolder = resolvePrimaryWorkspaceFolder(workspaceFolder) ?? workspaceFolder
  const primaryWorkspaceEnv = {
    ...processEnv,
    [PROJECT_WORKSPACE_FOLDER_ENV]: primaryWorkspaceFolder
  }
  return resolveProjectAiPath(
    primaryWorkspaceFolder,
    primaryWorkspaceEnv,
    'worktrees',
    'sessions',
    sessionId,
    resolveRepositoryDirectoryName(repositoryRoot, sessionId)
  )
}

const buildManagedWorktreeBranchName = (baseBranch: string, sessionId: string) => {
  const suffix = sessionId.slice(0, 8)
  return `${baseBranch}-session-${suffix}`
}

const getLatestSessionInfoCwd = (sessionId: string) => {
  const events = getDb().getMessages(sessionId) as WSEvent[]
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event?.type !== 'session_info' || !isRecord(event.info)) {
      continue
    }

    const info = event.info as SessionInfo & { cwd?: unknown }
    if (typeof info.cwd !== 'string' || info.cwd.trim() === '') {
      continue
    }

    const cwd = info.cwd.trim()
    return cwd.startsWith('/') ? cwd : resolve(getWorkspaceFolder(), cwd)
  }

  return undefined
}

const persistSessionWorkspace = (row: Omit<SessionWorkspaceRow, 'createdAt' | 'updatedAt'>) => {
  getDb().upsertSessionWorkspace(row)
  const created = getDb().getSessionWorkspace(row.sessionId)
  if (created == null) {
    throw new Error(`Failed to persist session workspace for ${row.sessionId}`)
  }
  return created
}

const persistSharedWorkspace = async (
  sessionId: string,
  workspaceFolder: string,
  kind: SessionWorkspaceKind,
  cleanupPolicy: SessionWorkspaceCleanupPolicy,
  worktreeEnvironment?: string
) => {
  let repositoryRoot: string | undefined
  try {
    repositoryRoot = await resolveGitRepositoryRoot(workspaceFolder)
  } catch (error) {
    if (!isGitMissingError(error) && !isGitNotRepositoryError(error)) {
      throw error
    }
  }

  return persistSessionWorkspace({
    sessionId,
    kind,
    workspaceFolder,
    repositoryRoot,
    worktreeEnvironment,
    cleanupPolicy,
    state: 'ready'
  })
}

const buildManagedWorkspace = async (
  sessionId: string,
  workspaceFolder: string,
  worktreeEnvironment?: string
) => {
  const repositoryRoot = await resolveGitRepositoryRoot(workspaceFolder)
  const currentBranch = await resolveGitCurrentBranch(workspaceFolder).catch(() => '')
  const normalizedBranch = currentBranch.trim() !== '' ? currentBranch.trim() : undefined
  const baseRef = normalizedBranch ?? await resolveGitHeadRef(workspaceFolder).catch(() => 'HEAD')
  const worktreePath = resolveManagedWorktreePath(workspaceFolder, sessionId, repositoryRoot)
  const branchName = normalizedBranch == null
    ? undefined
    : buildManagedWorktreeBranchName(normalizedBranch, sessionId)

  await mkdir(dirname(worktreePath), { recursive: true })
  let worktreeCreated = false
  try {
    await addGitWorktree({
      branch: branchName,
      cwd: repositoryRoot,
      path: worktreePath,
      ref: baseRef
    })
    worktreeCreated = true

    await runConfiguredWorktreeEnvironmentScripts({
      operation: 'create',
      workspaceFolder: worktreePath,
      sourceWorkspaceFolder: workspaceFolder,
      repositoryRoot: worktreePath,
      baseRef,
      environmentId: worktreeEnvironment,
      sessionId
    })
  } catch (error) {
    if (worktreeCreated) {
      await runConfiguredWorktreeEnvironmentScripts({
        operation: 'destroy',
        workspaceFolder: worktreePath,
        sourceWorkspaceFolder: workspaceFolder,
        repositoryRoot: worktreePath,
        baseRef,
        environmentId: worktreeEnvironment,
        force: true,
        sessionId
      }).catch((cleanupError) => {
        console.error(
          '[sessions] Failed to run worktree environment destroy scripts after create failure:',
          cleanupError
        )
      })
      await removeGitWorktree({
        cwd: repositoryRoot,
        path: worktreePath,
        force: true
      }).catch(() => undefined)
    }
    throw error
  }

  return persistSessionWorkspace({
    sessionId,
    kind: 'managed_worktree',
    workspaceFolder: worktreePath,
    repositoryRoot: worktreePath,
    worktreePath,
    baseRef,
    worktreeEnvironment,
    cleanupPolicy: DEFAULT_CLEANUP_POLICY,
    state: 'ready'
  })
}

const resolveManagedWorkspaceSource = async (
  sessionId: string,
  options: ProvisionSessionWorkspaceOptions
) => {
  if (options.sourceSessionId != null && options.sourceSessionId !== '') {
    const sourceWorkspace = await resolveSessionWorkspace(options.sourceSessionId)
    return sourceWorkspace.workspaceFolder
  }

  return getLatestSessionInfoCwd(sessionId) ?? getWorkspaceFolder()
}

export const provisionSessionWorkspace = async (
  sessionId: string,
  options: ProvisionSessionWorkspaceOptions = {}
) => {
  getSessionOrThrow(sessionId)

  const existing = getDb().getSessionWorkspace(sessionId)
  if (existing != null && existing.state === 'ready') {
    return existing
  }

  const sourceWorkspaceFolder = await resolveManagedWorkspaceSource(sessionId, options)
  const worktreeEnvironment = normalizeOptionalWorktreeEnvironmentId(options.worktreeEnvironment)

  if (options.createWorktree === false) {
    return await persistSharedWorkspace(
      sessionId,
      sourceWorkspaceFolder,
      'shared_workspace',
      'retain',
      worktreeEnvironment
    )
  }

  try {
    return await buildManagedWorkspace(sessionId, sourceWorkspaceFolder, worktreeEnvironment)
  } catch (error) {
    if (!isGitMissingError(error) && !isGitNotRepositoryError(error)) {
      throw error
    }

    return await persistSharedWorkspace(
      sessionId,
      sourceWorkspaceFolder,
      'shared_workspace',
      'retain',
      worktreeEnvironment
    )
  }
}

const recoverLegacySessionWorkspace = async (sessionId: string) => {
  getSessionOrThrow(sessionId)

  const legacyCwd = getLatestSessionInfoCwd(sessionId)
  if (legacyCwd != null) {
    return persistSharedWorkspace(sessionId, legacyCwd, 'external_workspace', 'retain')
  }

  return persistSharedWorkspace(sessionId, getWorkspaceFolder(), 'shared_workspace', 'retain')
}

export const resolveSessionWorkspace = async (sessionId: string) => {
  const existing = getDb().getSessionWorkspace(sessionId)
  if (existing != null && existing.state === 'ready') {
    return existing
  }

  return await recoverLegacySessionWorkspace(sessionId)
}

export const resolveSessionWorkspaceFolder = async (sessionId: string) => {
  const workspace = await resolveSessionWorkspace(sessionId)
  return workspace.workspaceFolder
}

export const createSessionManagedWorktree = async (sessionId: string) => {
  getSessionOrThrow(sessionId)

  const existing = await resolveSessionWorkspace(sessionId)
  if (existing.kind === 'managed_worktree') {
    return existing
  }

  try {
    return await buildManagedWorkspace(sessionId, existing.workspaceFolder, existing.worktreeEnvironment)
  } catch (error) {
    if (!isGitMissingError(error) && !isGitNotRepositoryError(error)) {
      throw error
    }

    throw conflict(
      'Session workspace is not a git repository',
      {
        sessionId,
        workspaceFolder: existing.workspaceFolder
      },
      'session_workspace_not_repository'
    )
  }
}

export const transferSessionWorkspaceToLocal = async (sessionId: string) => {
  const existing = await resolveSessionWorkspace(sessionId)
  if (existing.kind !== 'managed_worktree') {
    throw conflict(
      'Session workspace is not a managed worktree',
      { sessionId },
      'session_workspace_not_managed_worktree'
    )
  }

  getDb().updateSessionWorkspace(sessionId, {
    kind: 'external_workspace',
    cleanupPolicy: 'retain',
    state: 'ready',
    lastError: null
  })

  const updated = getDb().getSessionWorkspace(sessionId)
  if (updated == null) {
    throw new Error(`Failed to transfer session workspace for ${sessionId}`)
  }

  return updated
}

export const deleteSessionWorkspace = async (
  sessionId: string,
  options: {
    force?: boolean
  } = {}
) => {
  const workspace = getDb().getSessionWorkspace(sessionId)
  if (workspace == null) {
    return false
  }

  if (workspace.kind !== 'managed_worktree' || workspace.worktreePath == null || workspace.worktreePath.trim() === '') {
    getDb().deleteSessionWorkspace(sessionId)
    return true
  }

  if (options.force !== true) {
    const { stdout } = await runGitCommand(['status', '--short'], workspace.worktreePath)
    if (stdout !== '') {
      throw conflict(
        'Session worktree has uncommitted changes',
        {
          sessionId,
          worktreePath: workspace.worktreePath
        },
        'session_worktree_not_clean'
      )
    }
  }

  getDb().updateSessionWorkspace(sessionId, {
    state: 'deleting',
    lastError: null
  })

  try {
    await runConfiguredWorktreeEnvironmentScripts({
      operation: 'destroy',
      workspaceFolder: workspace.worktreePath,
      repositoryRoot: workspace.repositoryRoot?.trim() || workspace.worktreePath,
      baseRef: workspace.baseRef,
      environmentId: workspace.worktreeEnvironment,
      force: options.force === true,
      sessionId
    })

    await removeGitWorktree({
      cwd: workspace.repositoryRoot?.trim() || workspace.worktreePath,
      path: workspace.worktreePath,
      force: options.force !== false
    })
  } catch (error) {
    getDb().updateSessionWorkspace(sessionId, {
      state: 'broken',
      lastError: error instanceof Error ? error.message : String(error)
    })
    throw error
  }

  getDb().deleteSessionWorkspace(sessionId)
  return true
}
