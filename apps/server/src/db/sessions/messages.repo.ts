import { safeJsonStringify } from '#~/utils/json.js'

import type { SqliteDatabase } from '../sqlite'

export function createMessagesRepo(db: SqliteDatabase) {
  const save = (sessionId: string, data: unknown) => {
    const stmt = db.prepare('INSERT INTO messages (sessionId, data, createdAt) VALUES (?, ?, ?)')
    stmt.run(sessionId, safeJsonStringify(data), Date.now())
  }

  const list = (sessionId: string): unknown[] => {
    const stmt = db.prepare('SELECT data FROM messages WHERE sessionId = ? ORDER BY id ASC')
    const rows = stmt.all(sessionId) as { data: string }[]
    return rows.map(r => JSON.parse(r.data) as unknown)
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
