import { v4 as uuidv4 } from 'uuid'

import type { Session } from '@vibe-forge/core'
import { createEmptySessionPermissionState, normalizeSessionPermissionState } from '@vibe-forge/utils'
import type { SessionPermissionState } from '@vibe-forge/utils'

import { buildUpdateStatement } from '../repo.utils'
import type { SqliteDatabase } from '../sqlite'
import { normalizeSessionWorkspaceFileState, parseSessionWorkspaceFileState } from './workspace-file-state'

export type SessionRuntimeKind = 'interactive' | 'external'

export interface SessionRuntimeState {
  runtimeKind: SessionRuntimeKind
  historySeed?: string
  historySeedPending: boolean
  permissionState: SessionPermissionState
}

interface SessionRow {
  id: string
  parentSessionId: string | null
  title: string | null
  lastMessage: string | null
  lastUserMessage: string | null
  runtimeKind: string | null
  historySeed: string | null
  historySeedPending: number | null
  permissionState: string | null
  createdAt: number
  messageCount: number
  isStarred: number
  isArchived: number
  tags?: string
  status: string | null
  model: string | null
  adapter: string | null
  permissionMode: string | null
  effort: string | null
  workspaceFileState: string | null
}

type SessionUpdate = Partial<Omit<Session, 'id' | 'createdAt' | 'messageCount'>>
type SessionRuntimeUpdate = Partial<{
  runtimeKind: SessionRuntimeKind
  historySeed: string | null
  historySeedPending: boolean
  permissionState: SessionPermissionState
}>

const SESSION_SELECT = `
  SELECT s.*,
         (SELECT COUNT(*) FROM messages WHERE sessionId = s.id) as messageCount,
         (SELECT GROUP_CONCAT(t.name) FROM tags t JOIN session_tags st ON t.id = st.tagId WHERE st.sessionId = s.id) as tags
  FROM sessions s
`

const sessionUpdateFields = [
  { key: 'title' },
  { key: 'lastMessage' },
  { key: 'lastUserMessage' },
  { key: 'isStarred', toParam: value => value ? 1 : 0 },
  { key: 'isArchived', toParam: value => value ? 1 : 0 },
  { key: 'status' },
  { key: 'model' },
  { key: 'adapter' },
  { key: 'permissionMode' },
  { key: 'effort' },
  { key: 'workspaceFileState', toParam: value => JSON.stringify(normalizeSessionWorkspaceFileState(value)) }
] as const satisfies ReadonlyArray<{
  key: keyof SessionUpdate
  toParam?: (value: any) => string | number | null
}>

const sessionRuntimeUpdateFields = [
  { key: 'runtimeKind' },
  { key: 'historySeed', toParam: value => value ?? null },
  { key: 'historySeedPending', toParam: value => value ? 1 : 0 },
  { key: 'permissionState', toParam: value => JSON.stringify(normalizeSessionPermissionState(value)) }
] as const satisfies ReadonlyArray<{
  key: keyof SessionRuntimeUpdate
  toParam?: (value: any) => string | number | null
}>

const parsePermissionState = (value: string | null) => {
  if (value == null || value.trim() === '') {
    return createEmptySessionPermissionState()
  }

  try {
    return normalizeSessionPermissionState(JSON.parse(value))
  } catch {
    return createEmptySessionPermissionState()
  }
}

function mapSessionRow(row: SessionRow): Session {
  const workspaceFileState = parseSessionWorkspaceFileState(row.workspaceFileState)
  return {
    id: row.id,
    parentSessionId: row.parentSessionId ?? undefined,
    title: row.title ?? undefined,
    createdAt: row.createdAt,
    messageCount: row.messageCount,
    lastMessage: row.lastMessage ?? undefined,
    lastUserMessage: row.lastUserMessage ?? undefined,
    isStarred: row.isStarred === 1,
    isArchived: row.isArchived === 1,
    tags: (row.tags != null && row.tags !== '') ? row.tags.split(',') : [],
    status: (row.status as any) ?? undefined,
    model: row.model ?? undefined,
    adapter: row.adapter ?? undefined,
    permissionMode: (row.permissionMode as any) ?? undefined,
    effort: (row.effort as any) ?? undefined,
    ...(workspaceFileState == null ? {} : { workspaceFileState })
  }
}

function mapSessionRuntimeState(
  row: Pick<SessionRow, 'runtimeKind' | 'historySeed' | 'historySeedPending' | 'permissionState'>
): SessionRuntimeState {
  return {
    runtimeKind: row.runtimeKind === 'external' ? 'external' : 'interactive',
    historySeed: row.historySeed ?? undefined,
    historySeedPending: row.historySeedPending === 1,
    permissionState: parsePermissionState(row.permissionState)
  }
}

export function createSessionsRepo(db: SqliteDatabase) {
  const list = (filter: 'active' | 'archived' | 'all' = 'active'): Session[] => {
    let whereClause = ''
    if (filter === 'active') {
      whereClause = 'WHERE isArchived = 0'
    } else if (filter === 'archived') {
      whereClause = 'WHERE isArchived = 1'
    }

    const stmt = db.prepare(`
      ${SESSION_SELECT}
      ${whereClause}
      ORDER BY isStarred DESC, createdAt DESC
    `)
    const rows = stmt.all<SessionRow>()
    return rows.map(mapSessionRow)
  }

  const get = (id: string): Session | undefined => {
    const stmt = db.prepare(`
      ${SESSION_SELECT}
      WHERE s.id = ?
    `)
    const row = stmt.get<SessionRow>(id)
    if (row == null) return undefined
    return mapSessionRow(row)
  }

  const update = (id: string, updates: SessionUpdate) => {
    const statement = buildUpdateStatement('sessions', 'id', id, updates, sessionUpdateFields)
    if (!statement) return

    const stmt = db.prepare(statement.sql)
    stmt.run(...statement.params)
  }

  const updateRuntimeState = (id: string, updates: SessionRuntimeUpdate) => {
    const statement = buildUpdateStatement('sessions', 'id', id, updates, sessionRuntimeUpdateFields)
    if (!statement) return

    const stmt = db.prepare(statement.sql)
    stmt.run(...statement.params)
  }

  const setStarred = (id: string, isStarred: boolean) => {
    update(id, { isStarred })
  }

  const setArchived = (id: string, isArchived: boolean) => {
    update(id, { isArchived })
  }

  const archiveTree = (id: string, isArchived: boolean): string[] => {
    const stmt = db.prepare('SELECT id FROM sessions WHERE parentSessionId = ?')
    const updateStmt = db.prepare('UPDATE sessions SET isArchived = ? WHERE id = ?')
    const updatedIds: string[] = []
    const stack = [id]

    while (stack.length > 0) {
      const currentId = stack.pop()
      if (!currentId) continue
      updateStmt.run(isArchived ? 1 : 0, currentId)
      updatedIds.push(currentId)
      const rows = stmt.all<{ id: string }>(currentId)
      for (const row of rows) {
        stack.push(row.id)
      }
    }

    return updatedIds
  }

  const create = (
    title?: string,
    id?: string,
    status?: string,
    parentSessionId?: string,
    options: Partial<SessionRuntimeState> = {}
  ): Session => {
    const session: Session = {
      id: id ?? uuidv4(),
      parentSessionId: parentSessionId ?? undefined,
      title,
      createdAt: Date.now(),
      status: (status as any) ?? undefined
    }
    const runtimeKind = options.runtimeKind ?? (parentSessionId != null ? 'external' : 'interactive')
    const historySeed = options.historySeed ?? null
    const historySeedPending = options.historySeedPending === true ? 1 : 0
    const permissionState = JSON.stringify(normalizeSessionPermissionState(options.permissionState))
    const stmt = db.prepare(`
      INSERT INTO sessions (
        id,
        parentSessionId,
        title,
        runtimeKind,
        historySeed,
        historySeedPending,
        permissionState,
        createdAt,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      session.id,
      session.parentSessionId ?? null,
      session.title ?? null,
      runtimeKind,
      historySeed,
      historySeedPending,
      permissionState,
      session.createdAt,
      session.status ?? null
    )
    return session
  }

  const setTitle = (id: string, title: string) => {
    update(id, { title })
  }

  const setLastMessages = (id: string, lastMessage?: string, lastUserMessage?: string) => {
    update(id, { lastMessage, lastUserMessage })
  }

  const remove = (id: string): boolean => {
    const stmt = db.prepare('DELETE FROM sessions WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }

  const getRuntimeState = (id: string): SessionRuntimeState | undefined => {
    const stmt = db.prepare(
      'SELECT runtimeKind, historySeed, historySeedPending, permissionState FROM sessions WHERE id = ?'
    )
    const row = stmt.get<Pick<SessionRow, 'runtimeKind' | 'historySeed' | 'historySeedPending' | 'permissionState'>>(id)
    if (row == null) return undefined
    return mapSessionRuntimeState(row)
  }

  return {
    archiveTree,
    create,
    get,
    getRuntimeState,
    list,
    remove,
    setArchived,
    setLastMessages,
    setStarred,
    setTitle,
    update,
    updateRuntimeState
  }
}

export type SessionsRepo = ReturnType<typeof createSessionsRepo>
