import { buildUpdateStatement } from '../repo.utils'
import type { SqliteDatabase } from '../sqlite'

export type SessionWorkspaceKind = 'managed_worktree' | 'shared_workspace' | 'external_workspace'
export type SessionWorkspaceState = 'provisioning' | 'ready' | 'deleting' | 'deleted' | 'broken'
export type SessionWorkspaceCleanupPolicy = 'delete_on_session_delete' | 'retain'

export interface SessionWorkspaceRow {
  sessionId: string
  kind: SessionWorkspaceKind
  workspaceFolder: string
  repositoryRoot?: string
  worktreePath?: string
  baseRef?: string
  cleanupPolicy: SessionWorkspaceCleanupPolicy
  state: SessionWorkspaceState
  lastError?: string
  createdAt: number
  updatedAt: number
  deletedAt?: number
}

interface SessionWorkspaceDbRow {
  sessionId: string
  kind: SessionWorkspaceKind
  workspaceFolder: string
  repositoryRoot: string | null
  worktreePath: string | null
  baseRef: string | null
  cleanupPolicy: SessionWorkspaceCleanupPolicy
  state: SessionWorkspaceState
  lastError: string | null
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

type SessionWorkspaceUpdate = Partial<{
  kind: SessionWorkspaceKind
  workspaceFolder: string
  repositoryRoot: string | null
  worktreePath: string | null
  baseRef: string | null
  cleanupPolicy: SessionWorkspaceCleanupPolicy
  state: SessionWorkspaceState
  lastError: string | null
  deletedAt: number | null
}>

const workspaceUpdateFields = [
  { key: 'kind' },
  { key: 'workspaceFolder' },
  { key: 'repositoryRoot', toParam: value => value ?? null },
  { key: 'worktreePath', toParam: value => value ?? null },
  { key: 'baseRef', toParam: value => value ?? null },
  { key: 'cleanupPolicy' },
  { key: 'state' },
  { key: 'lastError', toParam: value => value ?? null },
  { key: 'deletedAt', toParam: value => value ?? null }
] as const satisfies ReadonlyArray<{
  key: keyof SessionWorkspaceUpdate
  toParam?: (value: any) => string | number | null
}>

const mapSessionWorkspaceRow = (row: SessionWorkspaceDbRow): SessionWorkspaceRow => ({
  ...row,
  repositoryRoot: row.repositoryRoot ?? undefined,
  worktreePath: row.worktreePath ?? undefined,
  baseRef: row.baseRef ?? undefined,
  lastError: row.lastError ?? undefined,
  deletedAt: row.deletedAt ?? undefined
})

export function createSessionWorkspacesRepo(db: SqliteDatabase) {
  const get = (sessionId: string): SessionWorkspaceRow | undefined => {
    const stmt = db.prepare(`
      SELECT
        sessionId,
        kind,
        workspaceFolder,
        repositoryRoot,
        worktreePath,
        baseRef,
        cleanupPolicy,
        state,
        lastError,
        createdAt,
        updatedAt,
        deletedAt
      FROM session_workspaces
      WHERE sessionId = ?
    `)
    const row = stmt.get<SessionWorkspaceDbRow>(sessionId)
    return row == null ? undefined : mapSessionWorkspaceRow(row)
  }

  const upsert = (
    row: Omit<SessionWorkspaceRow, 'createdAt' | 'updatedAt'> & Partial<Pick<SessionWorkspaceRow, 'createdAt'>>
  ) => {
    const now = Date.now()
    const createdAt = row.createdAt ?? now
    const stmt = db.prepare(`
      INSERT INTO session_workspaces (
        sessionId,
        kind,
        workspaceFolder,
        repositoryRoot,
        worktreePath,
        baseRef,
        cleanupPolicy,
        state,
        lastError,
        createdAt,
        updatedAt,
        deletedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(sessionId) DO UPDATE SET
        kind = excluded.kind,
        workspaceFolder = excluded.workspaceFolder,
        repositoryRoot = excluded.repositoryRoot,
        worktreePath = excluded.worktreePath,
        baseRef = excluded.baseRef,
        cleanupPolicy = excluded.cleanupPolicy,
        state = excluded.state,
        lastError = excluded.lastError,
        updatedAt = excluded.updatedAt,
        deletedAt = excluded.deletedAt
    `)
    stmt.run(
      row.sessionId,
      row.kind,
      row.workspaceFolder,
      row.repositoryRoot ?? null,
      row.worktreePath ?? null,
      row.baseRef ?? null,
      row.cleanupPolicy,
      row.state,
      row.lastError ?? null,
      createdAt,
      now,
      row.deletedAt ?? null
    )
  }

  const update = (sessionId: string, updates: SessionWorkspaceUpdate) => {
    const statement = buildUpdateStatement('session_workspaces', 'sessionId', sessionId, updates, workspaceUpdateFields)
    if (statement == null) {
      return
    }

    const now = Date.now()
    const stmt = db.prepare(`${statement.sql.replace(' WHERE', ', updatedAt = ? WHERE')}`)
    stmt.run(...statement.params.slice(0, -1), now, statement.params.at(-1) ?? sessionId)
  }

  const remove = (sessionId: string) => {
    const stmt = db.prepare('DELETE FROM session_workspaces WHERE sessionId = ?')
    return stmt.run(sessionId).changes
  }

  return {
    get,
    remove,
    update,
    upsert
  }
}
