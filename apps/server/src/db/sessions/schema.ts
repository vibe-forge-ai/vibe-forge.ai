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
        createdAt INTEGER NOT NULL,
        isStarred INTEGER DEFAULT 0,
        isArchived INTEGER DEFAULT 0,
        status TEXT,
        model TEXT,
        adapter TEXT,
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
    `)

    ensureColumn('sessions', 'isStarred', 'INTEGER DEFAULT 0')
    ensureColumn('sessions', 'isArchived', 'INTEGER DEFAULT 0')
    ensureColumn('sessions', 'parentSessionId', 'TEXT')
    ensureColumn('sessions', 'lastMessage', 'TEXT')
    ensureColumn('sessions', 'lastUserMessage', 'TEXT')
    ensureColumn('sessions', 'status', 'TEXT')
    ensureColumn('sessions', 'model', 'TEXT')
    ensureColumn('sessions', 'adapter', 'TEXT')
    ensureColumn('sessions', 'permissionMode', 'TEXT')
    ensureColumn('sessions', 'effort', 'TEXT')
  }
}
