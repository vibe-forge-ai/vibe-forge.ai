import type { SessionPermissionMode } from '@vibe-forge/core'

import type { SqliteDatabase } from '../sqlite'

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

export interface ChannelPreferenceRow {
  channelType: string
  sessionType: string
  channelId: string
  channelKey: string
  adapter?: string
  permissionMode?: SessionPermissionMode
  createdAt: number
  updatedAt: number
}

export function createChannelSessionsRepo(db: SqliteDatabase) {
  const get = (
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

  const getBySessionId = (sessionId: string): ChannelSessionRow | undefined => {
    const stmt = db.prepare(`
      SELECT channelType, sessionType, channelId, channelKey, replyReceiveId, replyReceiveIdType, sessionId, createdAt, updatedAt
      FROM channel_sessions
      WHERE sessionId = ?
      ORDER BY updatedAt DESC
      LIMIT 1
    `)
    return stmt.get(sessionId) as ChannelSessionRow | undefined
  }

  const upsert = (row: Omit<ChannelSessionRow, 'createdAt' | 'updatedAt'>) => {
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

  const removeBySessionId = (sessionId: string) => {
    const stmt = db.prepare(`
      DELETE FROM channel_sessions
      WHERE sessionId = ?
    `)
    return stmt.run(sessionId).changes
  }

  const getPreference = (
    channelType: string,
    sessionType: string,
    channelId: string
  ): ChannelPreferenceRow | undefined => {
    const stmt = db.prepare(`
      SELECT channelType, sessionType, channelId, channelKey, adapter, permissionMode, createdAt, updatedAt
      FROM channel_preferences
      WHERE channelType = ? AND sessionType = ? AND channelId = ?
    `)
    return stmt.get(channelType, sessionType, channelId) as ChannelPreferenceRow | undefined
  }

  const upsertPreference = (row: Omit<ChannelPreferenceRow, 'createdAt' | 'updatedAt'>) => {
    const now = Date.now()
    const stmt = db.prepare(`
      INSERT INTO channel_preferences (
        channelType, sessionType, channelId, channelKey, adapter, permissionMode, createdAt, updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(channelType, sessionType, channelId) DO UPDATE SET
        channelKey = excluded.channelKey,
        adapter = excluded.adapter,
        permissionMode = excluded.permissionMode,
        updatedAt = excluded.updatedAt
    `)
    stmt.run(
      row.channelType,
      row.sessionType,
      row.channelId,
      row.channelKey,
      row.adapter ?? null,
      row.permissionMode ?? null,
      now,
      now
    )
  }

  return {
    get,
    getPreference,
    getBySessionId,
    removeBySessionId,
    upsert,
    upsertPreference
  }
}
