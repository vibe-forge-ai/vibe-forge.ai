import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { env as processEnv } from 'node:process'

import type { WSEvent } from '@vibe-forge/core'
import type { SessionInfo } from '@vibe-forge/types'
import { resolvePrimaryWorkspaceFolder } from '@vibe-forge/register/dotenv'
import {
  addGitWorktree,
  isGitMissingError,
  isGitNotRepositoryError,
  removeGitWorktree,
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
import { conflict, notFound } from '#~/utils/http.js'

interface ProvisionSessionWorkspaceOptions {
  sourceSessionId?: string
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

const resolveManagedWorktreePath = (workspaceFolder: string, sessionId: string) => {
  const primaryWorkspaceFolder = resolvePrimaryWorkspaceFolder(workspaceFolder) ?? workspaceFolder
  return resolveProjectAiPath(primaryWorkspaceFolder, processEnv, 'worktrees', 'sessions', sessionId)
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
  cleanupPolicy: SessionWorkspaceCleanupPolicy
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
    cleanupPolicy,
    state: 'ready'
  })
}

const buildManagedWorkspace = async (
  sessionId: string,
  workspaceFolder: string
) => {
  const repositoryRoot = await resolveGitRepositoryRoot(workspaceFolder)
  const baseRef = await resolveGitHeadRef(workspaceFolder).catch(() => 'HEAD')
  const worktreePath = resolveManagedWorktreePath(workspaceFolder, sessionId)

  await mkdir(dirname(worktreePath), { recursive: true })
  await addGitWorktree({
    cwd: repositoryRoot,
    path: worktreePath,
    ref: baseRef
  })

  return persistSessionWorkspace({
    sessionId,
    kind: 'managed_worktree',
    workspaceFolder: worktreePath,
    repositoryRoot: worktreePath,
    worktreePath,
    baseRef,
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

  try {
    return await buildManagedWorkspace(sessionId, sourceWorkspaceFolder)
  } catch (error) {
    if (!isGitMissingError(error) && !isGitNotRepositoryError(error)) {
      throw error
    }

    return await persistSharedWorkspace(
      sessionId,
      sourceWorkspaceFolder,
      'shared_workspace',
      DEFAULT_CLEANUP_POLICY
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
