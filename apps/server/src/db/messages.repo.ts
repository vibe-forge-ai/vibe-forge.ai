import type Database from 'better-sqlite3'

import { safeJsonStringify } from '#~/utils/json.js'

export function createMessagesRepo(db: Database.Database) {
  const saveMessage = (sessionId: string, data: unknown) => {
    const stmt = db.prepare('INSERT INTO messages (sessionId, data, createdAt) VALUES (?, ?, ?)')
    stmt.run(sessionId, safeJsonStringify(data), Date.now())
  }

  const getMessages = (sessionId: string): unknown[] => {
    const stmt = db.prepare('SELECT data FROM messages WHERE sessionId = ? ORDER BY id ASC')
    const rows = stmt.all(sessionId) as { data: string }[]
    return rows.map(r => JSON.parse(r.data) as unknown)
  }

  const copyMessages = (fromSessionId: string, toSessionId: string) => {
    const messages = getMessages(fromSessionId)
    for (const msg of messages) {
      saveMessage(toSessionId, msg)
    }
  }

  return {
    copyMessages,
    getMessages,
    saveMessage
  }
}

export type MessagesRepo = ReturnType<typeof createMessagesRepo>
