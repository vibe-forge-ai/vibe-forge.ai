import type Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'

import type { Session } from '@vibe-forge/core'

import { buildUpdateStatement } from '../repo.utils'

interface SessionRow {
  id: string
  parentSessionId: string | null
  title: string | null
  lastMessage: string | null
  lastUserMessage: string | null
  createdAt: number
  messageCount: number
  isStarred: number
  isArchived: number
  tags?: string
  status: string | null
  model: string | null
  adapter: string | null
  permissionMode: string | null
}

type SessionUpdate = Partial<Omit<Session, 'id' | 'createdAt' | 'messageCount'>>

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
  { key: 'permissionMode' }
] as const satisfies ReadonlyArray<{
  key: keyof SessionUpdate
  toParam?: (value: any) => string | number | null
}>

function mapSessionRow(row: SessionRow): Session {
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
    permissionMode: (row.permissionMode as any) ?? undefined
  }
}

export function createSessionsRepo(db: Database.Database) {
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
    const rows = stmt.all() as SessionRow[]
    return rows.map(mapSessionRow)
  }

  const get = (id: string): Session | undefined => {
    const stmt = db.prepare(`
      ${SESSION_SELECT}
      WHERE s.id = ?
    `)
    const row = stmt.get(id) as (SessionRow | undefined)
    if (row == null) return undefined
    return mapSessionRow(row)
  }

  const update = (id: string, updates: SessionUpdate) => {
    const statement = buildUpdateStatement('sessions', 'id', id, updates, sessionUpdateFields)
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
      const rows = stmt.all(currentId) as { id: string }[]
      for (const row of rows) {
        stack.push(row.id)
      }
    }

    return updatedIds
  }

  const create = (title?: string, id?: string, status?: string, parentSessionId?: string): Session => {
    const session: Session = {
      id: id ?? uuidv4(),
      parentSessionId: parentSessionId ?? undefined,
      title,
      createdAt: Date.now(),
      status: (status as any) ?? undefined
    }
    const stmt = db.prepare(
      'INSERT INTO sessions (id, parentSessionId, title, createdAt, status) VALUES (?, ?, ?, ?, ?)'
    )
    stmt.run(session.id, session.parentSessionId ?? null, session.title, session.createdAt, session.status)
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

  return {
    archiveTree,
    create,
    get,
    list,
    remove,
    setArchived,
    setLastMessages,
    setStarred,
    setTitle,
    update
  }
}

export type SessionsRepo = ReturnType<typeof createSessionsRepo>
