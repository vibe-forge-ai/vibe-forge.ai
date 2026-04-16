import { safeJsonStringify } from '#~/utils/json.js'

import type { SqliteDatabase } from '../sqlite'

export function createMessagesRepo(db: SqliteDatabase) {
  const save = <T = unknown>(sessionId: string, data: T) => {
    const stmt = db.prepare('INSERT INTO messages (sessionId, data, createdAt) VALUES (?, ?, ?)')
    stmt.run(sessionId, safeJsonStringify(data), Date.now())
  }

  const list = <T = unknown>(sessionId: string): T[] => {
    const stmt = db.prepare('SELECT data FROM messages WHERE sessionId = ? ORDER BY id ASC')
    const rows = stmt.all<{ data: string }>(sessionId)
    return rows.map(r => JSON.parse(r.data) as T)
  }

  const copy = (fromSessionId: string, toSessionId: string) => {
    const messages = list(fromSessionId)
    for (const msg of messages) {
      save(toSessionId, msg)
    }
  }

  return {
    copy,
    list,
    save
  }
}

export type MessagesRepo = ReturnType<typeof createMessagesRepo>
