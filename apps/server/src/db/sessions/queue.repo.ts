import { v4 as uuidv4 } from 'uuid'

import type { ChatMessageContent, SessionQueuedMessage, SessionQueuedMessageMode } from '@vibe-forge/core'

import type { SqliteDatabase } from '../sqlite'

interface SessionQueuedMessageRow {
  id: string
  sessionId: string
  mode: SessionQueuedMessageMode
  orderIndex: number
  content: string
  createdAt: number
  updatedAt: number
}

const parseContent = (raw: string): ChatMessageContent[] => {
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed as ChatMessageContent[] : []
  } catch {
    return []
  }
}

const mapRow = (row: SessionQueuedMessageRow): SessionQueuedMessage => ({
  id: row.id,
  sessionId: row.sessionId,
  mode: row.mode,
  content: parseContent(row.content),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  order: row.orderIndex
})

export function createSessionQueueRepo(db: SqliteDatabase) {
  const list = (sessionId: string): SessionQueuedMessage[] => {
    const stmt = db.prepare(`
      SELECT id, sessionId, mode, orderIndex, content, createdAt, updatedAt
      FROM session_message_queue
      WHERE sessionId = ?
      ORDER BY CASE mode WHEN 'steer' THEN 0 ELSE 1 END, orderIndex ASC, createdAt ASC
    `)
    return stmt.all<SessionQueuedMessageRow>(sessionId).map(mapRow)
  }

  const get = (sessionId: string, id: string): SessionQueuedMessage | undefined => {
    const stmt = db.prepare(`
      SELECT id, sessionId, mode, orderIndex, content, createdAt, updatedAt
      FROM session_message_queue
      WHERE sessionId = ? AND id = ?
    `)
    const row = stmt.get<SessionQueuedMessageRow>(sessionId, id)
    return row == null ? undefined : mapRow(row)
  }

  const create = (sessionId: string, mode: SessionQueuedMessageMode, content: ChatMessageContent[]) => {
    const now = Date.now()
    const maxOrderStmt = db.prepare(`
      SELECT MAX(orderIndex) as orderIndex
      FROM session_message_queue
      WHERE sessionId = ? AND mode = ?
    `)
    const current = maxOrderStmt.get<{ orderIndex: number | null }>(sessionId, mode)
    const orderIndex = (current?.orderIndex ?? -1) + 1
    const queuedMessage: SessionQueuedMessage = {
      id: uuidv4(),
      sessionId,
      mode,
      content,
      createdAt: now,
      updatedAt: now,
      order: orderIndex
    }
    const stmt = db.prepare(`
      INSERT INTO session_message_queue (id, sessionId, mode, orderIndex, content, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      queuedMessage.id,
      sessionId,
      mode,
      orderIndex,
      JSON.stringify(content),
      now,
      now
    )
    return queuedMessage
  }

  const update = (sessionId: string, id: string, content: ChatMessageContent[]) => {
    const now = Date.now()
    const stmt = db.prepare(`
      UPDATE session_message_queue
      SET content = ?, updatedAt = ?
      WHERE sessionId = ? AND id = ?
    `)
    stmt.run(JSON.stringify(content), now, sessionId, id)
    return get(sessionId, id)
  }

  const move = (sessionId: string, id: string, mode: SessionQueuedMessageMode) => {
    const target = get(sessionId, id)
    if (target == null) {
      return undefined
    }

    if (target.mode === mode) {
      return target
    }

    const tx = db.transaction(() => {
      const now = Date.now()
      const currentMaxOrderStmt = db.prepare(`
        SELECT MAX(orderIndex) as orderIndex
        FROM session_message_queue
        WHERE sessionId = ? AND mode = ?
      `)
      const nextOrder = ((currentMaxOrderStmt.get<{ orderIndex: number | null }>(sessionId, mode)?.orderIndex) ?? -1) +
        1

      const moveStmt = db.prepare(`
        UPDATE session_message_queue
        SET mode = ?, orderIndex = ?, updatedAt = ?
        WHERE sessionId = ? AND id = ?
      `)
      moveStmt.run(mode, nextOrder, now, sessionId, id)

      const reorderSourceStmt = db.prepare(`
        UPDATE session_message_queue
        SET orderIndex = orderIndex - 1, updatedAt = ?
        WHERE sessionId = ? AND mode = ? AND orderIndex > ?
      `)
      reorderSourceStmt.run(now, sessionId, target.mode, target.order)
    })

    tx()
    return get(sessionId, id)
  }

  const remove = (sessionId: string, id: string) => {
    const target = get(sessionId, id)
    if (target == null) return false

    const tx = db.transaction(() => {
      const deleteStmt = db.prepare(`
        DELETE FROM session_message_queue
        WHERE sessionId = ? AND id = ?
      `)
      deleteStmt.run(sessionId, id)

      const reorderStmt = db.prepare(`
        UPDATE session_message_queue
        SET orderIndex = orderIndex - 1
        WHERE sessionId = ? AND mode = ? AND orderIndex > ?
      `)
      reorderStmt.run(sessionId, target.mode, target.order)
    })

    tx()
    return true
  }

  const reorder = (sessionId: string, mode: SessionQueuedMessageMode, ids: string[]) => {
    const items = list(sessionId).filter(item => item.mode === mode)
    const existingIds = new Set(items.map(item => item.id))
    if (ids.length !== items.length || ids.some(id => !existingIds.has(id))) {
      throw new Error('Invalid queue order')
    }

    const tx = db.transaction(() => {
      const stmt = db.prepare(`
        UPDATE session_message_queue
        SET orderIndex = ?, updatedAt = ?
        WHERE sessionId = ? AND id = ?
      `)
      const now = Date.now()
      ids.forEach((id, index) => {
        stmt.run(index, now, sessionId, id)
      })
    })

    tx()
    return list(sessionId).filter(item => item.mode === mode)
  }

  return {
    list,
    get,
    create,
    update,
    move,
    remove,
    reorder
  }
}

export type SessionQueueRepo = ReturnType<typeof createSessionQueueRepo>
