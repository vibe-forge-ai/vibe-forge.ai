import type { SchemaModule } from '../schema'

export const sessionsSchemaModule: SchemaModule = {
  name: 'sessions',
  apply({ exec, ensureColumn }) {
    exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        parentSessionId TEXT,
        title TEXT,
        lastMessage TEXT,
        lastUserMessage TEXT,
        runtimeKind TEXT NOT NULL DEFAULT 'interactive',
        historySeed TEXT,
        historySeedPending INTEGER NOT NULL DEFAULT 0,
        permissionState TEXT,
        createdAt INTEGER NOT NULL,
        isStarred INTEGER DEFAULT 0,
        isArchived INTEGER DEFAULT 0,
        status TEXT,
        model TEXT,
        adapter TEXT,
        account TEXT,
        permissionMode TEXT,
        effort TEXT
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId TEXT NOT NULL,
        data TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY(sessionId) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS session_message_queue (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        mode TEXT NOT NULL,
        orderIndex INTEGER NOT NULL,
        content TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        FOREIGN KEY(sessionId) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      );

      CREATE TABLE IF NOT EXISTS session_tags (
        sessionId TEXT NOT NULL,
        tagId INTEGER NOT NULL,
        PRIMARY KEY (sessionId, tagId),
        FOREIGN KEY(sessionId) REFERENCES sessions(id) ON DELETE CASCADE,
        FOREIGN KEY(tagId) REFERENCES tags(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_messages_sessionId ON messages(sessionId);
      CREATE INDEX IF NOT EXISTS idx_session_message_queue_sessionId ON session_message_queue(sessionId, mode, orderIndex);
    `)

    ensureColumn('sessions', 'isStarred', 'INTEGER DEFAULT 0')
    ensureColumn('sessions', 'isArchived', 'INTEGER DEFAULT 0')
    ensureColumn('sessions', 'parentSessionId', 'TEXT')
    ensureColumn('sessions', 'lastMessage', 'TEXT')
    ensureColumn('sessions', 'lastUserMessage', 'TEXT')
    ensureColumn('sessions', 'runtimeKind', 'TEXT')
    ensureColumn('sessions', 'historySeed', 'TEXT')
    ensureColumn('sessions', 'historySeedPending', 'INTEGER DEFAULT 0')
    ensureColumn('sessions', 'permissionState', 'TEXT')
    ensureColumn('sessions', 'status', 'TEXT')
    ensureColumn('sessions', 'model', 'TEXT')
    ensureColumn('sessions', 'adapter', 'TEXT')
    ensureColumn('sessions', 'account', 'TEXT')
    ensureColumn('sessions', 'permissionMode', 'TEXT')
    ensureColumn('sessions', 'effort', 'TEXT')
    exec(`
      UPDATE sessions
      SET runtimeKind = CASE
        WHEN runtimeKind IS NULL AND parentSessionId IS NOT NULL THEN 'external'
        WHEN runtimeKind IS NULL THEN 'interactive'
        ELSE runtimeKind
      END;

      UPDATE sessions
      SET historySeedPending = COALESCE(historySeedPending, 0);

      UPDATE sessions
      SET permissionState = COALESCE(permissionState, '{"allow":[],"deny":[],"onceAllow":[],"onceDeny":[]}');
    `)
  }
}
