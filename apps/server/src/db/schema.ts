import type Database from 'better-sqlite3'

export function initSchema(db: Database.Database) {
  db.exec(`
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
        permissionMode TEXT
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

      CREATE INDEX IF NOT EXISTS idx_messages_sessionId ON messages(sessionId);

      CREATE TABLE IF NOT EXISTS automation_rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        intervalMs INTEGER,
        webhookKey TEXT,
        cronExpression TEXT,
        prompt TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        createdAt INTEGER NOT NULL,
        lastRunAt INTEGER,
        lastSessionId TEXT
      );

      CREATE TABLE IF NOT EXISTS automation_triggers (
        id TEXT PRIMARY KEY,
        ruleId TEXT NOT NULL,
        type TEXT NOT NULL,
        intervalMs INTEGER,
        cronExpression TEXT,
        webhookKey TEXT,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY(ruleId) REFERENCES automation_rules(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS automation_tasks (
        id TEXT PRIMARY KEY,
        ruleId TEXT NOT NULL,
        title TEXT NOT NULL,
        prompt TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY(ruleId) REFERENCES automation_rules(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS automation_runs (
        id TEXT PRIMARY KEY,
        ruleId TEXT NOT NULL,
        sessionId TEXT NOT NULL,
        taskId TEXT,
        taskTitle TEXT,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY(ruleId) REFERENCES automation_rules(id) ON DELETE CASCADE,
        FOREIGN KEY(sessionId) REFERENCES sessions(id) ON DELETE CASCADE
      );
    `)

  const tableInfo = db.prepare('PRAGMA table_info(sessions)').all() as { name: string }[]
  const columns = tableInfo.map(c => c.name)
  if (!columns.includes('isStarred')) {
    db.exec('ALTER TABLE sessions ADD COLUMN isStarred INTEGER DEFAULT 0')
  }
  if (!columns.includes('isArchived')) {
    db.exec('ALTER TABLE sessions ADD COLUMN isArchived INTEGER DEFAULT 0')
  }
  if (!columns.includes('parentSessionId')) {
    db.exec('ALTER TABLE sessions ADD COLUMN parentSessionId TEXT')
  }
  if (!columns.includes('lastMessage')) {
    db.exec('ALTER TABLE sessions ADD COLUMN lastMessage TEXT')
  }
  if (!columns.includes('lastUserMessage')) {
    db.exec('ALTER TABLE sessions ADD COLUMN lastUserMessage TEXT')
  }
  if (!columns.includes('status')) {
    db.exec('ALTER TABLE sessions ADD COLUMN status TEXT')
  }
  if (!columns.includes('model')) {
    db.exec('ALTER TABLE sessions ADD COLUMN model TEXT')
  }
  if (!columns.includes('adapter')) {
    db.exec('ALTER TABLE sessions ADD COLUMN adapter TEXT')
  }
  if (!columns.includes('permissionMode')) {
    db.exec('ALTER TABLE sessions ADD COLUMN permissionMode TEXT')
  }

  const channelSessionsInfo = db.prepare('PRAGMA table_info(channel_sessions)').all() as { name: string }[]
  const channelSessionsColumns = channelSessionsInfo.map(c => c.name)
  if (channelSessionsColumns.length > 0) {
    if (!channelSessionsColumns.includes('replyReceiveId')) {
      db.exec('ALTER TABLE channel_sessions ADD COLUMN replyReceiveId TEXT')
    }
    if (!channelSessionsColumns.includes('replyReceiveIdType')) {
      db.exec('ALTER TABLE channel_sessions ADD COLUMN replyReceiveIdType TEXT')
    }
  }

  const automationTableInfo = db.prepare('PRAGMA table_info(automation_rules)').all() as { name: string }[]
  const automationColumns = automationTableInfo.map(c => c.name)
  if (automationColumns.length === 0) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS automation_rules (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          type TEXT NOT NULL,
          intervalMs INTEGER,
          webhookKey TEXT,
          cronExpression TEXT,
          prompt TEXT NOT NULL,
          enabled INTEGER DEFAULT 1,
          createdAt INTEGER NOT NULL,
          lastRunAt INTEGER,
          lastSessionId TEXT
        );
      `)
  } else {
    if (!automationColumns.includes('description')) {
      db.exec('ALTER TABLE automation_rules ADD COLUMN description TEXT')
    }
    if (!automationColumns.includes('intervalMs')) {
      db.exec('ALTER TABLE automation_rules ADD COLUMN intervalMs INTEGER')
    }
    if (!automationColumns.includes('webhookKey')) {
      db.exec('ALTER TABLE automation_rules ADD COLUMN webhookKey TEXT')
    }
    if (!automationColumns.includes('cronExpression')) {
      db.exec('ALTER TABLE automation_rules ADD COLUMN cronExpression TEXT')
    }
    if (!automationColumns.includes('enabled')) {
      db.exec('ALTER TABLE automation_rules ADD COLUMN enabled INTEGER DEFAULT 1')
    }
    if (!automationColumns.includes('createdAt')) {
      db.exec('ALTER TABLE automation_rules ADD COLUMN createdAt INTEGER NOT NULL DEFAULT 0')
    }
    if (!automationColumns.includes('lastRunAt')) {
      db.exec('ALTER TABLE automation_rules ADD COLUMN lastRunAt INTEGER')
    }
    if (!automationColumns.includes('lastSessionId')) {
      db.exec('ALTER TABLE automation_rules ADD COLUMN lastSessionId TEXT')
    }
  }

  const automationTriggerTableInfo = db.prepare('PRAGMA table_info(automation_triggers)').all() as { name: string }[]
  const automationTriggerColumns = automationTriggerTableInfo.map(c => c.name)
  if (automationTriggerColumns.length === 0) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS automation_triggers (
          id TEXT PRIMARY KEY,
          ruleId TEXT NOT NULL,
          type TEXT NOT NULL,
          intervalMs INTEGER,
          cronExpression TEXT,
          webhookKey TEXT,
          createdAt INTEGER NOT NULL,
          FOREIGN KEY(ruleId) REFERENCES automation_rules(id) ON DELETE CASCADE
        );
      `)
  } else {
    if (!automationTriggerColumns.includes('intervalMs')) {
      db.exec('ALTER TABLE automation_triggers ADD COLUMN intervalMs INTEGER')
    }
    if (!automationTriggerColumns.includes('cronExpression')) {
      db.exec('ALTER TABLE automation_triggers ADD COLUMN cronExpression TEXT')
    }
    if (!automationTriggerColumns.includes('webhookKey')) {
      db.exec('ALTER TABLE automation_triggers ADD COLUMN webhookKey TEXT')
    }
    if (!automationTriggerColumns.includes('createdAt')) {
      db.exec('ALTER TABLE automation_triggers ADD COLUMN createdAt INTEGER NOT NULL DEFAULT 0')
    }
  }

  const automationTaskTableInfo = db.prepare('PRAGMA table_info(automation_tasks)').all() as { name: string }[]
  const automationTaskColumns = automationTaskTableInfo.map(c => c.name)
  if (automationTaskColumns.length === 0) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS automation_tasks (
          id TEXT PRIMARY KEY,
          ruleId TEXT NOT NULL,
          title TEXT NOT NULL,
          prompt TEXT NOT NULL,
          createdAt INTEGER NOT NULL,
          FOREIGN KEY(ruleId) REFERENCES automation_rules(id) ON DELETE CASCADE
        );
      `)
  } else {
    if (!automationTaskColumns.includes('title')) {
      db.exec('ALTER TABLE automation_tasks ADD COLUMN title TEXT NOT NULL DEFAULT ""')
    }
    if (!automationTaskColumns.includes('prompt')) {
      db.exec('ALTER TABLE automation_tasks ADD COLUMN prompt TEXT NOT NULL DEFAULT ""')
    }
    if (!automationTaskColumns.includes('createdAt')) {
      db.exec('ALTER TABLE automation_tasks ADD COLUMN createdAt INTEGER NOT NULL DEFAULT 0')
    }
  }

  const automationRunTableInfo = db.prepare('PRAGMA table_info(automation_runs)').all() as { name: string }[]
  const automationRunColumns = automationRunTableInfo.map(c => c.name)
  if (automationRunColumns.length === 0) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS automation_runs (
          id TEXT PRIMARY KEY,
          ruleId TEXT NOT NULL,
          sessionId TEXT NOT NULL,
          taskId TEXT,
          taskTitle TEXT,
          createdAt INTEGER NOT NULL,
          FOREIGN KEY(ruleId) REFERENCES automation_rules(id) ON DELETE CASCADE,
          FOREIGN KEY(sessionId) REFERENCES sessions(id) ON DELETE CASCADE
        );
      `)
  } else {
    if (!automationRunColumns.includes('taskId')) {
      db.exec('ALTER TABLE automation_runs ADD COLUMN taskId TEXT')
    }
    if (!automationRunColumns.includes('taskTitle')) {
      db.exec('ALTER TABLE automation_runs ADD COLUMN taskTitle TEXT')
    }
  }
}
