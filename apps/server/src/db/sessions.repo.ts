import type Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'

import type { Session } from '@vibe-forge/core'

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

export function createSessionsRepo(db: Database.Database) {
  const getSessions = (filter: 'active' | 'archived' | 'all' = 'active'): Session[] => {
    let whereClause = ''
    if (filter === 'active') {
      whereClause = 'WHERE isArchived = 0'
    } else if (filter === 'archived') {
      whereClause = 'WHERE isArchived = 1'
    }

    const stmt = db.prepare(`
      SELECT s.*, 
             (SELECT COUNT(*) FROM messages WHERE sessionId = s.id) as messageCount,
             (SELECT GROUP_CONCAT(t.name) FROM tags t JOIN session_tags st ON t.id = st.tagId WHERE st.sessionId = s.id) as tags
      FROM sessions s 
      ${whereClause}
      ORDER BY isStarred DESC, createdAt DESC
    `)
    const rows = stmt.all() as SessionRow[]
    return rows.map(row => ({
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
    }))
  }

  const getSession = (id: string): Session | undefined => {
    const stmt = db.prepare(`
      SELECT s.*,
             (SELECT COUNT(*) FROM messages WHERE sessionId = s.id) as messageCount,
             (SELECT GROUP_CONCAT(t.name) FROM tags t JOIN session_tags st ON t.id = st.tagId WHERE st.sessionId = s.id) as tags
      FROM sessions s WHERE s.id = ?
    `)
    const row = stmt.get(id) as (SessionRow | undefined)
    if (row == null) return undefined
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

  const updateSession = (id: string, updates: Partial<Omit<Session, 'id' | 'createdAt' | 'messageCount'>>) => {
    const sets: string[] = []
    const params: (string | number | null)[] = []

    if (updates.title !== undefined) {
      sets.push('title = ?')
      params.push(updates.title)
    }
    if (updates.lastMessage !== undefined) {
      sets.push('lastMessage = ?')
      params.push(updates.lastMessage)
    }
    if (updates.lastUserMessage !== undefined) {
      sets.push('lastUserMessage = ?')
      params.push(updates.lastUserMessage)
    }
    if (updates.isStarred !== undefined) {
      sets.push('isStarred = ?')
      params.push(updates.isStarred ? 1 : 0)
    }
    if (updates.isArchived !== undefined) {
      sets.push('isArchived = ?')
      params.push(updates.isArchived ? 1 : 0)
    }
    if (updates.status !== undefined) {
      sets.push('status = ?')
      params.push(updates.status)
    }
    if (updates.model !== undefined) {
      sets.push('model = ?')
      params.push(updates.model)
    }
    if (updates.adapter !== undefined) {
      sets.push('adapter = ?')
      params.push(updates.adapter)
    }
    if (updates.permissionMode !== undefined) {
      sets.push('permissionMode = ?')
      params.push(updates.permissionMode)
    }

    if (sets.length === 0) return

    const queryStr = `UPDATE sessions SET ${sets.join(', ')} WHERE id = ?`
    params.push(id)

    const stmt = db.prepare(queryStr)
    stmt.run(...params)
  }

  const updateSessionStarred = (id: string, isStarred: boolean) => {
    updateSession(id, { isStarred })
  }

  const updateSessionArchived = (id: string, isArchived: boolean) => {
    updateSession(id, { isArchived })
  }

  const updateSessionArchivedWithChildren = (id: string, isArchived: boolean): string[] => {
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

  const createSession = (title?: string, id?: string, status?: string, parentSessionId?: string): Session => {
    const session: Session = {
      id: id ?? uuidv4(),
      parentSessionId: parentSessionId ?? undefined,
      title,
      createdAt: Date.now(),
      status: (status as any) ?? undefined
    }
    const stmt = db.prepare('INSERT INTO sessions (id, parentSessionId, title, createdAt, status) VALUES (?, ?, ?, ?, ?)')
    stmt.run(session.id, session.parentSessionId ?? null, session.title, session.createdAt, session.status)
    return session
  }

  const updateSessionTitle = (id: string, title: string) => {
    updateSession(id, { title })
  }

  const updateSessionLastMessages = (id: string, lastMessage?: string, lastUserMessage?: string) => {
    updateSession(id, { lastMessage, lastUserMessage })
  }

  const deleteSession = (id: string): boolean => {
    const stmt = db.prepare('DELETE FROM sessions WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }

  return {
    createSession,
    deleteSession,
    getSession,
    getSessions,
    updateSession,
    updateSessionArchived,
    updateSessionArchivedWithChildren,
    updateSessionLastMessages,
    updateSessionStarred,
    updateSessionTitle
  }
}

export type SessionsRepo = ReturnType<typeof createSessionsRepo>
