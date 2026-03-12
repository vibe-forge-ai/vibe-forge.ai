import type Database from 'better-sqlite3'

export interface ChannelSessionRow {
  channelType: string
  sessionType: string
  channelId: string
  channelKey: string
  replyReceiveId?: string
  replyReceiveIdType?: string
  sessionId: string
  createdAt: number
  updatedAt: number
}

export function createChannelSessionsRepo(db: Database.Database) {
  const getChannelSession = (
    channelType: string,
    sessionType: string,
    channelId: string
  ): ChannelSessionRow | undefined => {
    const stmt = db.prepare(`
      SELECT channelType, sessionType, channelId, channelKey, replyReceiveId, replyReceiveIdType, sessionId, createdAt, updatedAt
      FROM channel_sessions
      WHERE channelType = ? AND sessionType = ? AND channelId = ?
    `)
    return stmt.get(channelType, sessionType, channelId) as ChannelSessionRow | undefined
  }

  const getChannelSessionBySessionId = (sessionId: string): ChannelSessionRow | undefined => {
    const stmt = db.prepare(`
      SELECT channelType, sessionType, channelId, channelKey, replyReceiveId, replyReceiveIdType, sessionId, createdAt, updatedAt
      FROM channel_sessions
      WHERE sessionId = ?
      ORDER BY updatedAt DESC
      LIMIT 1
    `)
    return stmt.get(sessionId) as ChannelSessionRow | undefined
  }

  const upsertChannelSession = (row: Omit<ChannelSessionRow, 'createdAt' | 'updatedAt'>) => {
    const now = Date.now()
    const stmt = db.prepare(`
      INSERT INTO channel_sessions (channelType, sessionType, channelId, channelKey, replyReceiveId, replyReceiveIdType, sessionId, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(channelType, sessionType, channelId) DO UPDATE SET
        channelKey = excluded.channelKey,
        replyReceiveId = excluded.replyReceiveId,
        replyReceiveIdType = excluded.replyReceiveIdType,
        sessionId = excluded.sessionId,
        updatedAt = excluded.updatedAt
    `)
    stmt.run(
      row.channelType,
      row.sessionType,
      row.channelId,
      row.channelKey,
      row.replyReceiveId ?? null,
      row.replyReceiveIdType ?? null,
      row.sessionId,
      now,
      now
    )
  }

  const deleteChannelSessionBySessionId = (sessionId: string) => {
    const stmt = db.prepare(`
      DELETE FROM channel_sessions
      WHERE sessionId = ?
    `)
    return stmt.run(sessionId).changes
  }

  return {
    getChannelSession,
    getChannelSessionBySessionId,
    upsertChannelSession,
    deleteChannelSessionBySessionId
  }
}
