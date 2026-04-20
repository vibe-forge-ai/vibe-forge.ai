import type { SchemaModule } from '../schema'

export const channelSessionsSchemaModule: SchemaModule = {
  name: 'channel-sessions',
  apply({ db, exec, ensureColumn, getColumns }) {
    exec(`
      CREATE TABLE IF NOT EXISTS channel_sessions (
        channelType TEXT NOT NULL,
        channelKey TEXT NOT NULL,
        sessionType TEXT NOT NULL,
        channelId TEXT NOT NULL,
        replyReceiveId TEXT,
        replyReceiveIdType TEXT,
        sessionId TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        PRIMARY KEY (channelType, channelKey, sessionType, channelId),
        FOREIGN KEY(sessionId) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_channel_sessions_sessionId ON channel_sessions(sessionId);

      CREATE TABLE IF NOT EXISTS channel_preferences (
        channelType TEXT NOT NULL,
        channelKey TEXT NOT NULL,
        sessionType TEXT NOT NULL,
        channelId TEXT NOT NULL,
        adapter TEXT,
        permissionMode TEXT,
        effort TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        PRIMARY KEY (channelType, channelKey, sessionType, channelId)
      );
    `)

    const getPrimaryKeyColumns = (tableName: string) => (
      db.prepare(`PRAGMA table_info(${tableName})`)
        .all<{ name: string; pk: number }>()
        .filter(column => column.pk > 0)
        .sort((left, right) => left.pk - right.pk)
        .map(column => column.name)
    )

    const sessionPk = getPrimaryKeyColumns('channel_sessions').join(',')
    if (sessionPk === 'channelType,sessionType,channelId') {
      exec(`
        ALTER TABLE channel_sessions RENAME TO channel_sessions_legacy;
        CREATE TABLE channel_sessions (
          channelType TEXT NOT NULL,
          channelKey TEXT NOT NULL,
          sessionType TEXT NOT NULL,
          channelId TEXT NOT NULL,
          replyReceiveId TEXT,
          replyReceiveIdType TEXT,
          sessionId TEXT NOT NULL,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL,
          PRIMARY KEY (channelType, channelKey, sessionType, channelId),
          FOREIGN KEY(sessionId) REFERENCES sessions(id) ON DELETE CASCADE
        );
        INSERT INTO channel_sessions (
          channelType, channelKey, sessionType, channelId, replyReceiveId, replyReceiveIdType, sessionId, createdAt, updatedAt
        )
        SELECT
          channelType, channelKey, sessionType, channelId, replyReceiveId, replyReceiveIdType, sessionId, createdAt, updatedAt
        FROM channel_sessions_legacy;
        DROP TABLE channel_sessions_legacy;
        CREATE INDEX IF NOT EXISTS idx_channel_sessions_sessionId ON channel_sessions(sessionId);
      `)
    }

    const preferencePk = getPrimaryKeyColumns('channel_preferences').join(',')
    if (preferencePk === 'channelType,sessionType,channelId') {
      exec(`
        ALTER TABLE channel_preferences RENAME TO channel_preferences_legacy;
        CREATE TABLE channel_preferences (
          channelType TEXT NOT NULL,
          channelKey TEXT NOT NULL,
          sessionType TEXT NOT NULL,
          channelId TEXT NOT NULL,
          adapter TEXT,
          permissionMode TEXT,
          effort TEXT,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL,
          PRIMARY KEY (channelType, channelKey, sessionType, channelId)
        );
        INSERT INTO channel_preferences (
          channelType, channelKey, sessionType, channelId, adapter, permissionMode, effort, createdAt, updatedAt
        )
        SELECT
          channelType, channelKey, sessionType, channelId, adapter, permissionMode, effort, createdAt, updatedAt
        FROM channel_preferences_legacy;
        DROP TABLE channel_preferences_legacy;
      `)
    }

    if (getColumns('channel_sessions').length > 0) {
      ensureColumn('channel_sessions', 'channelKey', 'TEXT')
      ensureColumn('channel_sessions', 'replyReceiveId', 'TEXT')
      ensureColumn('channel_sessions', 'replyReceiveIdType', 'TEXT')
    }

    if (getColumns('channel_preferences').length > 0) {
      ensureColumn('channel_preferences', 'channelKey', 'TEXT')
      ensureColumn('channel_preferences', 'adapter', 'TEXT')
      ensureColumn('channel_preferences', 'permissionMode', 'TEXT')
      ensureColumn('channel_preferences', 'effort', 'TEXT')
    }
  }
}
