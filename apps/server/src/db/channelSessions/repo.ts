import type { EffortLevel, SessionPermissionMode } from '@vibe-forge/core'

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
  effort?: EffortLevel
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
    return stmt.get<ChannelSessionRow>(channelType, sessionType, channelId)
  }

  const getBySessionId = (sessionId: string): ChannelSessionRow | undefined => {
    const stmt = db.prepare(`
      SELECT channelType, sessionType, channelId, channelKey, replyReceiveId, replyReceiveIdType, sessionId, createdAt, updatedAt
      FROM channel_sessions
      WHERE sessionId = ?
      ORDER BY updatedAt DESC
      LIMIT 1
    `)
    return stmt.get<ChannelSessionRow>(sessionId)
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

  const remove = (channelType: string, sessionType: string, channelId: string) => {
    const stmt = db.prepare(`
      DELETE FROM channel_sessions
      WHERE channelType = ? AND sessionType = ? AND channelId = ?
    `)
    return stmt.run(channelType, sessionType, channelId).changes
  }

  const getPreference = (
    channelType: string,
    sessionType: string,
    channelId: string
  ): ChannelPreferenceRow | undefined => {
    const stmt = db.prepare(`
      SELECT channelType, sessionType, channelId, channelKey, adapter, permissionMode, effort, createdAt, updatedAt
      FROM channel_preferences
      WHERE channelType = ? AND sessionType = ? AND channelId = ?
    `)
    return stmt.get<ChannelPreferenceRow>(channelType, sessionType, channelId)
  }

  const upsertPreference = (row: Omit<ChannelPreferenceRow, 'createdAt' | 'updatedAt'>) => {
    const now = Date.now()
    const stmt = db.prepare(`
      INSERT INTO channel_preferences (
        channelType, sessionType, channelId, channelKey, adapter, permissionMode, effort, createdAt, updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(channelType, sessionType, channelId) DO UPDATE SET
        channelKey = excluded.channelKey,
        adapter = excluded.adapter,
        permissionMode = excluded.permissionMode,
        effort = excluded.effort,
        updatedAt = excluded.updatedAt
    `)
    stmt.run(
      row.channelType,
      row.sessionType,
      row.channelId,
      row.channelKey,
      row.adapter ?? null,
      row.permissionMode ?? null,
      row.effort ?? null,
      now,
      now
    )
  }

  return {
    get,
    getPreference,
    getBySessionId,
    remove,
    removeBySessionId,
    upsert,
    upsertPreference
  }
}
