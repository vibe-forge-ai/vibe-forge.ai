import type { SchemaModule } from '../schema'

export const automationSchemaModule: SchemaModule = {
  name: 'automation',
  apply({ exec, ensureColumn, getColumns }) {
    exec(`
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

    if (getColumns('automation_rules').length > 0) {
      ensureColumn('automation_rules', 'description', 'TEXT')
      ensureColumn('automation_rules', 'intervalMs', 'INTEGER')
      ensureColumn('automation_rules', 'webhookKey', 'TEXT')
      ensureColumn('automation_rules', 'cronExpression', 'TEXT')
      ensureColumn('automation_rules', 'enabled', 'INTEGER DEFAULT 1')
      ensureColumn('automation_rules', 'createdAt', 'INTEGER NOT NULL DEFAULT 0')
      ensureColumn('automation_rules', 'lastRunAt', 'INTEGER')
      ensureColumn('automation_rules', 'lastSessionId', 'TEXT')
    }

    if (getColumns('automation_triggers').length > 0) {
      ensureColumn('automation_triggers', 'intervalMs', 'INTEGER')
      ensureColumn('automation_triggers', 'cronExpression', 'TEXT')
      ensureColumn('automation_triggers', 'webhookKey', 'TEXT')
      ensureColumn('automation_triggers', 'createdAt', 'INTEGER NOT NULL DEFAULT 0')
    }

    if (getColumns('automation_tasks').length > 0) {
      ensureColumn('automation_tasks', 'title', 'TEXT NOT NULL DEFAULT ""')
      ensureColumn('automation_tasks', 'prompt', 'TEXT NOT NULL DEFAULT ""')
      ensureColumn('automation_tasks', 'createdAt', 'INTEGER NOT NULL DEFAULT 0')
    }

    if (getColumns('automation_runs').length > 0) {
      ensureColumn('automation_runs', 'taskId', 'TEXT')
      ensureColumn('automation_runs', 'taskTitle', 'TEXT')
    }
  }
}
