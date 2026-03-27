import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'

import { automationSchemaModule } from '../../src/db/automation/schema'
import { channelSessionsSchemaModule } from '../../src/db/channelSessions/schema'
import {  initSchema } from '../../src/db/schema'
import type {SchemaModule} from '../../src/db/schema';
import { sessionsSchemaModule } from '../../src/db/sessions/schema'

describe('db schema modules', () => {
  let sqlite: Database.Database | undefined

  afterEach(() => {
    sqlite?.close()
    sqlite = undefined
  })

  it('supports injected schema modules', () => {
    sqlite = new Database(':memory:')
    const customSchemaModule: SchemaModule = {
      name: 'custom',
      apply({ exec }) {
        exec('CREATE TABLE IF NOT EXISTS custom_records (id TEXT PRIMARY KEY, name TEXT NOT NULL);')
      }
    }

    initSchema(sqlite, [customSchemaModule])

    const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").all(
      'custom_records'
    )
    expect(tables).toHaveLength(1)
  })

  it('migrates missing columns in domain schema modules', () => {
    sqlite = new Database(':memory:')
    sqlite.exec(`
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        title TEXT,
        createdAt INTEGER NOT NULL
      );
      CREATE TABLE channel_sessions (
        channelType TEXT NOT NULL,
        sessionType TEXT NOT NULL,
        channelId TEXT NOT NULL,
        channelKey TEXT NOT NULL,
        sessionId TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        PRIMARY KEY (channelType, sessionType, channelId)
      );
      CREATE TABLE automation_rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        prompt TEXT NOT NULL
      );
      CREATE TABLE automation_triggers (
        id TEXT PRIMARY KEY,
        ruleId TEXT NOT NULL,
        type TEXT NOT NULL
      );
      CREATE TABLE automation_tasks (
        id TEXT PRIMARY KEY,
        ruleId TEXT NOT NULL
      );
      CREATE TABLE automation_runs (
        id TEXT PRIMARY KEY,
        ruleId TEXT NOT NULL,
        sessionId TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      );
    `)

    initSchema(sqlite, [sessionsSchemaModule, channelSessionsSchemaModule, automationSchemaModule])

    const sessionColumns = sqlite.prepare('PRAGMA table_info(sessions)').all() as Array<{ name: string }>
    const channelColumns = sqlite.prepare('PRAGMA table_info(channel_sessions)').all() as Array<{ name: string }>
    const channelPreferenceColumns = sqlite.prepare('PRAGMA table_info(channel_preferences)').all() as Array<{ name: string }>
    const automationRuleColumns = sqlite.prepare('PRAGMA table_info(automation_rules)').all() as Array<{ name: string }>
    const automationTaskColumns = sqlite.prepare('PRAGMA table_info(automation_tasks)').all() as Array<{ name: string }>
    const automationRunColumns = sqlite.prepare('PRAGMA table_info(automation_runs)').all() as Array<{ name: string }>

    expect(sessionColumns.map(column => column.name)).toEqual(expect.arrayContaining([
      'parentSessionId',
      'lastMessage',
      'lastUserMessage',
      'isStarred',
      'isArchived',
      'status',
      'model',
      'adapter',
      'permissionMode'
    ]))
    expect(channelColumns.map(column => column.name)).toEqual(expect.arrayContaining([
      'replyReceiveId',
      'replyReceiveIdType'
    ]))
    expect(channelPreferenceColumns.map(column => column.name)).toEqual(expect.arrayContaining([
      'channelType',
      'sessionType',
      'channelId',
      'channelKey',
      'adapter',
      'permissionMode',
      'createdAt',
      'updatedAt'
    ]))
    expect(automationRuleColumns.map(column => column.name)).toEqual(expect.arrayContaining([
      'description',
      'intervalMs',
      'webhookKey',
      'cronExpression',
      'enabled',
      'createdAt',
      'lastRunAt',
      'lastSessionId'
    ]))
    expect(automationTaskColumns.map(column => column.name)).toEqual(expect.arrayContaining([
      'title',
      'prompt',
      'createdAt'
    ]))
    expect(automationRunColumns.map(column => column.name)).toEqual(expect.arrayContaining([
      'taskId',
      'taskTitle'
    ]))
  })
})
