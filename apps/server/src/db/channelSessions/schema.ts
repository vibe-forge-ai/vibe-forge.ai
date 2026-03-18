import type { SchemaModule } from '../schema'

export const channelSessionsSchemaModule: SchemaModule = {
  name: 'channel-sessions',
  apply({ exec, ensureColumn, getColumns }) {
    exec(`
      CREATE TABLE IF NOT EXISTS channel_sessions (
        channelType TEXT NOT NULL,
        sessionType TEXT NOT NULL,
        channelId TEXT NOT NULL,
        channelKey TEXT NOT NULL,
        replyReceiveId TEXT,
        replyReceiveIdType TEXT,
        sessionId TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        PRIMARY KEY (channelType, sessionType, channelId),
        FOREIGN KEY(sessionId) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_channel_sessions_sessionId ON channel_sessions(sessionId);
    `)

    if (getColumns('channel_sessions').length > 0) {
      ensureColumn('channel_sessions', 'replyReceiveId', 'TEXT')
      ensureColumn('channel_sessions', 'replyReceiveIdType', 'TEXT')
    }
  }
}