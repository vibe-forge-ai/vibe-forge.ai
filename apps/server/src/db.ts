import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { env as processEnv } from 'node:process'

import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'

import { safeJsonStringify } from '#~/utils/json.js'
import type { ChatMessage, ChatMessageContent, Session } from '@vibe-forge/core'

interface SessionRow {
  id: string
  parentSessionId: string | null
  title: string | null
  lastMessage: string | null
  lastUserMessage: string | null
  createdAt: number
  messageCount: number
  lastMessageData?: string
  lastUserMessageData?: string
  isStarred: number
  isArchived: number
  tags?: string // JSON string array or comma separated
  status: string | null
}

export interface AutomationRule {
  id: string
  name: string
  description?: string | null
  type: 'interval' | 'webhook' | 'cron'
  intervalMs?: number | null
  webhookKey?: string | null
  cronExpression?: string | null
  prompt: string
  enabled: boolean
  createdAt: number
  lastRunAt?: number | null
  lastSessionId?: string | null
}

export interface AutomationRuleDetail extends AutomationRule {
  triggers: AutomationTrigger[]
  tasks: AutomationTask[]
}

export interface AutomationTrigger {
  id: string
  ruleId: string
  type: 'interval' | 'webhook' | 'cron'
  intervalMs?: number | null
  cronExpression?: string | null
  webhookKey?: string | null
  createdAt: number
}

export interface AutomationTask {
  id: string
  ruleId: string
  title: string
  prompt: string
  createdAt: number
}

export interface AutomationRun {
  id: string
  ruleId: string
  sessionId: string
  runAt: number
  taskId?: string | null
  taskTitle?: string | null
  status?: string
  title?: string
  lastMessage?: string
  lastUserMessage?: string
}

export class SqliteDb {
  private db: Database.Database
  private dbPath: string

  constructor() {
    // Resolve DB path
    let dbPath = processEnv.DB_PATH

    if (dbPath == null || dbPath === '') {
      const homeDir = os.homedir()
      const vfDir = path.join(homeDir, '.vf')
      if (!fs.existsSync(vfDir)) {
        fs.mkdirSync(vfDir, { recursive: true })
      }
      dbPath = path.join(vfDir, 'db.sqlite')
    } else {
      const dir = path.dirname(dbPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      // If dbPath is a directory, append default filename
      if (fs.existsSync(dbPath) && fs.statSync(dbPath).isDirectory()) {
        dbPath = path.join(dbPath, 'db.sqlite')
      }
    }

    this.dbPath = dbPath
    this.db = new Database(dbPath)
    this.init()
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        parentSessionId TEXT,
        title TEXT,
        lastMessage TEXT,
        lastUserMessage TEXT,
        createdAt INTEGER NOT NULL,
        isStarred INTEGER DEFAULT 0,
        isArchived INTEGER DEFAULT 0,
        status TEXT
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

    // Ensure columns exist for existing databases
    const tableInfo = this.db.prepare('PRAGMA table_info(sessions)').all() as { name: string }[]
    const columns = tableInfo.map(c => c.name)
    if (!columns.includes('isStarred')) {
      this.db.exec('ALTER TABLE sessions ADD COLUMN isStarred INTEGER DEFAULT 0')
    }
    if (!columns.includes('isArchived')) {
      this.db.exec('ALTER TABLE sessions ADD COLUMN isArchived INTEGER DEFAULT 0')
    }
    if (!columns.includes('parentSessionId')) {
      this.db.exec('ALTER TABLE sessions ADD COLUMN parentSessionId TEXT')
    }
    if (!columns.includes('lastMessage')) {
      this.db.exec('ALTER TABLE sessions ADD COLUMN lastMessage TEXT')
    }
    if (!columns.includes('lastUserMessage')) {
      this.db.exec('ALTER TABLE sessions ADD COLUMN lastUserMessage TEXT')
    }
    if (!columns.includes('status')) {
      this.db.exec('ALTER TABLE sessions ADD COLUMN status TEXT')
    }

    const automationTableInfo = this.db.prepare('PRAGMA table_info(automation_rules)').all() as { name: string }[]
    const automationColumns = automationTableInfo.map(c => c.name)
    if (automationColumns.length === 0) {
      this.db.exec(`
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
        this.db.exec('ALTER TABLE automation_rules ADD COLUMN description TEXT')
      }
      if (!automationColumns.includes('intervalMs')) {
        this.db.exec('ALTER TABLE automation_rules ADD COLUMN intervalMs INTEGER')
      }
      if (!automationColumns.includes('webhookKey')) {
        this.db.exec('ALTER TABLE automation_rules ADD COLUMN webhookKey TEXT')
      }
      if (!automationColumns.includes('cronExpression')) {
        this.db.exec('ALTER TABLE automation_rules ADD COLUMN cronExpression TEXT')
      }
      if (!automationColumns.includes('enabled')) {
        this.db.exec('ALTER TABLE automation_rules ADD COLUMN enabled INTEGER DEFAULT 1')
      }
      if (!automationColumns.includes('createdAt')) {
        this.db.exec('ALTER TABLE automation_rules ADD COLUMN createdAt INTEGER NOT NULL DEFAULT 0')
      }
      if (!automationColumns.includes('lastRunAt')) {
        this.db.exec('ALTER TABLE automation_rules ADD COLUMN lastRunAt INTEGER')
      }
      if (!automationColumns.includes('lastSessionId')) {
        this.db.exec('ALTER TABLE automation_rules ADD COLUMN lastSessionId TEXT')
      }
    }

    const automationTriggerTableInfo = this.db.prepare('PRAGMA table_info(automation_triggers)').all() as { name: string }[]
    const automationTriggerColumns = automationTriggerTableInfo.map(c => c.name)
    if (automationTriggerColumns.length === 0) {
      this.db.exec(`
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
        this.db.exec('ALTER TABLE automation_triggers ADD COLUMN intervalMs INTEGER')
      }
      if (!automationTriggerColumns.includes('cronExpression')) {
        this.db.exec('ALTER TABLE automation_triggers ADD COLUMN cronExpression TEXT')
      }
      if (!automationTriggerColumns.includes('webhookKey')) {
        this.db.exec('ALTER TABLE automation_triggers ADD COLUMN webhookKey TEXT')
      }
      if (!automationTriggerColumns.includes('createdAt')) {
        this.db.exec('ALTER TABLE automation_triggers ADD COLUMN createdAt INTEGER NOT NULL DEFAULT 0')
      }
    }

    const automationTaskTableInfo = this.db.prepare('PRAGMA table_info(automation_tasks)').all() as { name: string }[]
    const automationTaskColumns = automationTaskTableInfo.map(c => c.name)
    if (automationTaskColumns.length === 0) {
      this.db.exec(`
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
        this.db.exec('ALTER TABLE automation_tasks ADD COLUMN title TEXT NOT NULL DEFAULT ""')
      }
      if (!automationTaskColumns.includes('prompt')) {
        this.db.exec('ALTER TABLE automation_tasks ADD COLUMN prompt TEXT NOT NULL DEFAULT ""')
      }
      if (!automationTaskColumns.includes('createdAt')) {
        this.db.exec('ALTER TABLE automation_tasks ADD COLUMN createdAt INTEGER NOT NULL DEFAULT 0')
      }
    }

    const automationRunTableInfo = this.db.prepare('PRAGMA table_info(automation_runs)').all() as { name: string }[]
    const automationRunColumns = automationRunTableInfo.map(c => c.name)
    if (automationRunColumns.length === 0) {
      this.db.exec(`
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
        this.db.exec('ALTER TABLE automation_runs ADD COLUMN taskId TEXT')
      }
      if (!automationRunColumns.includes('taskTitle')) {
        this.db.exec('ALTER TABLE automation_runs ADD COLUMN taskTitle TEXT')
      }
    }
  }

  getSessions(filter: 'active' | 'archived' | 'all' = 'active'): Session[] {
    let whereClause = ''
    if (filter === 'active') {
      whereClause = 'WHERE isArchived = 0'
    } else if (filter === 'archived') {
      whereClause = 'WHERE isArchived = 1'
    }

    const stmt = this.db.prepare(`
      SELECT s.*, 
             (SELECT COUNT(*) FROM messages WHERE sessionId = s.id) as messageCount,
             (SELECT GROUP_CONCAT(t.name) FROM tags t JOIN session_tags st ON t.id = st.tagId WHERE st.sessionId = s.id) as tags
      FROM sessions s 
      ${whereClause}
      ORDER BY isStarred DESC, createdAt DESC
    `)
    const rows = stmt.all() as SessionRow[]
    return rows.map(row => {
      return {
        id: row.id,
        parentSessionId: row.parentSessionId ?? undefined,
        title: row.title ?? undefined,
        createdAt: row.createdAt,
        messageCount: row.messageCount,
        lastMessage: row.lastMessage ?? undefined,
        lastUserMessage: row.lastUserMessage ?? undefined,
        isStarred: row.isStarred === 1,
        isArchived: row.isArchived === 1,
        tags: (row.tags != null && row.tags !== '') ? row.tags.split(',') : [],
        status: (row.status as any) ?? undefined
      }
    })
  }

  getSession(id: string): Session | undefined {
    const stmt = this.db.prepare(`
      SELECT s.*,
             (SELECT COUNT(*) FROM messages WHERE sessionId = s.id) as messageCount,
             (SELECT GROUP_CONCAT(t.name) FROM tags t JOIN session_tags st ON t.id = st.tagId WHERE st.sessionId = s.id) as tags
      FROM sessions s WHERE s.id = ?
    `)
    const row = stmt.get(id) as (SessionRow | undefined)
    if (row == null) return undefined
    return {
      id: row.id,
      parentSessionId: row.parentSessionId ?? undefined,
      title: row.title ?? undefined,
      createdAt: row.createdAt,
      messageCount: row.messageCount,
      lastMessage: row.lastMessage ?? undefined,
      lastUserMessage: row.lastUserMessage ?? undefined,
      isStarred: row.isStarred === 1,
      isArchived: row.isArchived === 1,
      tags: (row.tags != null && row.tags !== '') ? row.tags.split(',') : [],
      status: (row.status as any) ?? undefined
    }
  }

  private extractTextFromMessageData(messageData?: string): string | undefined {
    if (messageData == null || messageData === '') return undefined
    try {
      const data = JSON.parse(messageData) as ChatMessage
      if (typeof data.content === 'string') {
        return data.content
      } else if (Array.isArray(data.content)) {
        const textContent = data.content.find((c: ChatMessageContent) => c.type === 'text')
        if (textContent != null && 'text' in textContent) {
          return textContent.text
        }
      }
    } catch (e) {}
    return undefined
  }

  updateSession(id: string, updates: Partial<Omit<Session, 'id' | 'createdAt' | 'messageCount'>>) {
    const sets: string[] = []
    const params: (string | number | null)[] = []

    if (updates.title !== undefined) {
      sets.push('title = ?')
      params.push(updates.title)
    }
    if (updates.lastMessage !== undefined) {
      sets.push('lastMessage = ?')
      params.push(updates.lastMessage)
    }
    if (updates.lastUserMessage !== undefined) {
      sets.push('lastUserMessage = ?')
      params.push(updates.lastUserMessage)
    }
    if (updates.isStarred !== undefined) {
      sets.push('isStarred = ?')
      params.push(updates.isStarred ? 1 : 0)
    }
    if (updates.isArchived !== undefined) {
      sets.push('isArchived = ?')
      params.push(updates.isArchived ? 1 : 0)
    }
    if (updates.status !== undefined) {
      sets.push('status = ?')
      params.push(updates.status)
    }

    if (sets.length === 0) return

    const queryStr = `UPDATE sessions SET ${sets.join(', ')} WHERE id = ?`
    params.push(id)

    const stmt = this.db.prepare(queryStr)
    stmt.run(...params)
  }

  updateSessionStarred(id: string, isStarred: boolean) {
    this.updateSession(id, { isStarred })
  }

  updateSessionArchived(id: string, isArchived: boolean) {
    this.updateSession(id, { isArchived })
  }

  updateSessionArchivedWithChildren(id: string, isArchived: boolean): string[] {
    const stmt = this.db.prepare('SELECT id FROM sessions WHERE parentSessionId = ?')
    const updateStmt = this.db.prepare('UPDATE sessions SET isArchived = ? WHERE id = ?')
    const updatedIds: string[] = []
    const stack = [id]

    while (stack.length > 0) {
      const currentId = stack.pop()
      if (!currentId) continue
      updateStmt.run(isArchived ? 1 : 0, currentId)
      updatedIds.push(currentId)
      const rows = stmt.all(currentId) as { id: string }[]
      for (const row of rows) {
        stack.push(row.id)
      }
    }

    return updatedIds
  }

  updateSessionTags(sessionId: string, tags: string[]) {
    const transaction = this.db.transaction(() => {
      // 1. Delete existing tags for this session
      this.db.prepare('DELETE FROM session_tags WHERE sessionId = ?').run(sessionId)

      // 2. Insert new tags and link them
      for (const tagName of tags) {
        // Ensure tag exists
        this.db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(tagName)
        const tag = this.db.prepare('SELECT id FROM tags WHERE name = ?').get(tagName) as { id: number }

        // Link session to tag
        this.db.prepare('INSERT OR IGNORE INTO session_tags (sessionId, tagId) VALUES (?, ?)').run(sessionId, tag.id)
      }
    })
    transaction()
  }

  saveMessage(sessionId: string, data: unknown) {
    const stmt = this.db.prepare('INSERT INTO messages (sessionId, data, createdAt) VALUES (?, ?, ?)')
    stmt.run(sessionId, safeJsonStringify(data), Date.now())
  }

  getMessages(sessionId: string): unknown[] {
    const stmt = this.db.prepare('SELECT data FROM messages WHERE sessionId = ? ORDER BY id ASC')
    const rows = stmt.all(sessionId) as { data: string }[]
    return rows.map(r => JSON.parse(r.data) as unknown)
  }

  copyMessages(fromSessionId: string, toSessionId: string) {
    const messages = this.getMessages(fromSessionId)
    for (const msg of messages) {
      this.saveMessage(toSessionId, msg)
    }
  }

  createSession(title?: string, id?: string, status?: string, parentSessionId?: string): Session {
    const session: Session = {
      id: id ?? uuidv4(),
      parentSessionId: parentSessionId ?? undefined,
      title,
      createdAt: Date.now(),
      status: (status as any) ?? undefined
    }
    const stmt = this.db.prepare('INSERT INTO sessions (id, parentSessionId, title, createdAt, status) VALUES (?, ?, ?, ?, ?)')
    stmt.run(session.id, session.parentSessionId ?? null, session.title, session.createdAt, session.status)
    return session
  }

  updateSessionTitle(id: string, title: string) {
    this.updateSession(id, { title })
  }

  updateSessionLastMessages(id: string, lastMessage?: string, lastUserMessage?: string) {
    this.updateSession(id, { lastMessage, lastUserMessage })
  }

  deleteSession(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }

  close() {
    this.db.close()
  }

  listAutomationRules(): AutomationRule[] {
    const stmt = this.db.prepare('SELECT * FROM automation_rules ORDER BY createdAt DESC')
    const rows = stmt.all() as Array<{
      id: string
      name: string
      description: string | null
      type: string
      intervalMs: number | null
      webhookKey: string | null
      cronExpression: string | null
      prompt: string
      enabled: number
      createdAt: number
      lastRunAt: number | null
      lastSessionId: string | null
    }>
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description ?? null,
      type: row.type === 'webhook' ? 'webhook' : row.type === 'cron' ? 'cron' : 'interval',
      intervalMs: row.intervalMs ?? null,
      webhookKey: row.webhookKey ?? null,
      cronExpression: row.cronExpression ?? null,
      prompt: row.prompt,
      enabled: row.enabled === 1,
      createdAt: row.createdAt,
      lastRunAt: row.lastRunAt ?? null,
      lastSessionId: row.lastSessionId ?? null
    }))
  }

  listAutomationRuleDetails(): AutomationRuleDetail[] {
    const rules = this.listAutomationRules()
    const triggerRows = this.db.prepare('SELECT * FROM automation_triggers').all() as Array<{
      id: string
      ruleId: string
      type: string
      intervalMs: number | null
      cronExpression: string | null
      webhookKey: string | null
      createdAt: number
    }>
    const taskRows = this.db.prepare('SELECT * FROM automation_tasks').all() as Array<{
      id: string
      ruleId: string
      title: string
      prompt: string
      createdAt: number
    }>
    const triggerMap = new Map<string, AutomationTrigger[]>()
    const taskMap = new Map<string, AutomationTask[]>()
    for (const row of triggerRows) {
      const list = triggerMap.get(row.ruleId) ?? []
      list.push({
        id: row.id,
        ruleId: row.ruleId,
        type: row.type === 'webhook' ? 'webhook' : row.type === 'cron' ? 'cron' : 'interval',
        intervalMs: row.intervalMs ?? null,
        cronExpression: row.cronExpression ?? null,
        webhookKey: row.webhookKey ?? null,
        createdAt: row.createdAt
      })
      triggerMap.set(row.ruleId, list)
    }
    for (const row of taskRows) {
      const list = taskMap.get(row.ruleId) ?? []
      list.push({
        id: row.id,
        ruleId: row.ruleId,
        title: row.title,
        prompt: row.prompt,
        createdAt: row.createdAt
      })
      taskMap.set(row.ruleId, list)
    }
    return rules.map(rule => ({
      ...rule,
      triggers: triggerMap.get(rule.id) ?? [],
      tasks: taskMap.get(rule.id) ?? []
    }))
  }

  getAutomationRuleDetail(id: string): AutomationRuleDetail | undefined {
    const rule = this.getAutomationRule(id)
    if (!rule) return undefined
    return {
      ...rule,
      triggers: this.listAutomationTriggers(id),
      tasks: this.listAutomationTasks(id)
    }
  }

  getAutomationRule(id: string): AutomationRule | undefined {
    const stmt = this.db.prepare('SELECT * FROM automation_rules WHERE id = ?')
    const row = stmt.get(id) as {
      id: string
      name: string
      description: string | null
      type: string
      intervalMs: number | null
      webhookKey: string | null
      cronExpression: string | null
      prompt: string
      enabled: number
      createdAt: number
      lastRunAt: number | null
      lastSessionId: string | null
    } | undefined
    if (row == null) return undefined
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? null,
      type: row.type === 'webhook' ? 'webhook' : row.type === 'cron' ? 'cron' : 'interval',
      intervalMs: row.intervalMs ?? null,
      webhookKey: row.webhookKey ?? null,
      cronExpression: row.cronExpression ?? null,
      prompt: row.prompt,
      enabled: row.enabled === 1,
      createdAt: row.createdAt,
      lastRunAt: row.lastRunAt ?? null,
      lastSessionId: row.lastSessionId ?? null
    }
  }

  createAutomationRule(rule: AutomationRule) {
    const stmt = this.db.prepare(`
      INSERT INTO automation_rules (id, name, description, type, intervalMs, webhookKey, cronExpression, prompt, enabled, createdAt, lastRunAt, lastSessionId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      rule.id,
      rule.name,
      rule.description ?? null,
      rule.type,
      rule.intervalMs ?? null,
      rule.webhookKey ?? null,
      rule.cronExpression ?? null,
      rule.prompt,
      rule.enabled ? 1 : 0,
      rule.createdAt,
      rule.lastRunAt ?? null,
      rule.lastSessionId ?? null
    )
  }

  updateAutomationRule(id: string, updates: Partial<Omit<AutomationRule, 'id' | 'createdAt'>>) {
    const sets: string[] = []
    const params: (string | number | null)[] = []

    if (updates.name !== undefined) {
      sets.push('name = ?')
      params.push(updates.name)
    }
    if (updates.description !== undefined) {
      sets.push('description = ?')
      params.push(updates.description ?? null)
    }
    if (updates.type !== undefined) {
      sets.push('type = ?')
      params.push(updates.type)
    }
    if (updates.intervalMs !== undefined) {
      sets.push('intervalMs = ?')
      params.push(updates.intervalMs ?? null)
    }
    if (updates.webhookKey !== undefined) {
      sets.push('webhookKey = ?')
      params.push(updates.webhookKey ?? null)
    }
    if (updates.cronExpression !== undefined) {
      sets.push('cronExpression = ?')
      params.push(updates.cronExpression ?? null)
    }
    if (updates.prompt !== undefined) {
      sets.push('prompt = ?')
      params.push(updates.prompt)
    }
    if (updates.enabled !== undefined) {
      sets.push('enabled = ?')
      params.push(updates.enabled ? 1 : 0)
    }
    if (updates.lastRunAt !== undefined) {
      sets.push('lastRunAt = ?')
      params.push(updates.lastRunAt ?? null)
    }
    if (updates.lastSessionId !== undefined) {
      sets.push('lastSessionId = ?')
      params.push(updates.lastSessionId ?? null)
    }

    if (sets.length === 0) return
    const queryStr = `UPDATE automation_rules SET ${sets.join(', ')} WHERE id = ?`
    params.push(id)
    const stmt = this.db.prepare(queryStr)
    stmt.run(...params)
  }

  deleteAutomationRule(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM automation_rules WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }

  listAutomationTriggers(ruleId: string): AutomationTrigger[] {
    const stmt = this.db.prepare('SELECT * FROM automation_triggers WHERE ruleId = ? ORDER BY createdAt ASC')
    const rows = stmt.all(ruleId) as Array<{
      id: string
      ruleId: string
      type: string
      intervalMs: number | null
      cronExpression: string | null
      webhookKey: string | null
      createdAt: number
    }>
    return rows.map(row => ({
      id: row.id,
      ruleId: row.ruleId,
      type: row.type === 'webhook' ? 'webhook' : row.type === 'cron' ? 'cron' : 'interval',
      intervalMs: row.intervalMs ?? null,
      cronExpression: row.cronExpression ?? null,
      webhookKey: row.webhookKey ?? null,
      createdAt: row.createdAt
    }))
  }

  getAutomationTrigger(id: string): AutomationTrigger | undefined {
    const stmt = this.db.prepare('SELECT * FROM automation_triggers WHERE id = ?')
    const row = stmt.get(id) as {
      id: string
      ruleId: string
      type: string
      intervalMs: number | null
      cronExpression: string | null
      webhookKey: string | null
      createdAt: number
    } | undefined
    if (!row) return undefined
    return {
      id: row.id,
      ruleId: row.ruleId,
      type: row.type === 'webhook' ? 'webhook' : row.type === 'cron' ? 'cron' : 'interval',
      intervalMs: row.intervalMs ?? null,
      cronExpression: row.cronExpression ?? null,
      webhookKey: row.webhookKey ?? null,
      createdAt: row.createdAt
    }
  }

  replaceAutomationTriggers(ruleId: string, triggers: Array<Omit<AutomationTrigger, 'id' | 'ruleId' | 'createdAt'> & { id?: string }>) {
    const transaction = this.db.transaction(() => {
      this.db.prepare('DELETE FROM automation_triggers WHERE ruleId = ?').run(ruleId)
      const stmt = this.db.prepare(`
        INSERT INTO automation_triggers (id, ruleId, type, intervalMs, cronExpression, webhookKey, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      for (const trigger of triggers) {
        stmt.run(
          trigger.id ?? uuidv4(),
          ruleId,
          trigger.type,
          trigger.intervalMs ?? null,
          trigger.cronExpression ?? null,
          trigger.webhookKey ?? null,
          Date.now()
        )
      }
    })
    transaction()
  }

  listAutomationTasks(ruleId: string): AutomationTask[] {
    const stmt = this.db.prepare('SELECT * FROM automation_tasks WHERE ruleId = ? ORDER BY createdAt ASC')
    const rows = stmt.all(ruleId) as Array<{
      id: string
      ruleId: string
      title: string
      prompt: string
      createdAt: number
    }>
    return rows.map(row => ({
      id: row.id,
      ruleId: row.ruleId,
      title: row.title,
      prompt: row.prompt,
      createdAt: row.createdAt
    }))
  }

  replaceAutomationTasks(ruleId: string, tasks: Array<Omit<AutomationTask, 'id' | 'ruleId' | 'createdAt'> & { id?: string }>) {
    const transaction = this.db.transaction(() => {
      this.db.prepare('DELETE FROM automation_tasks WHERE ruleId = ?').run(ruleId)
      const stmt = this.db.prepare(`
        INSERT INTO automation_tasks (id, ruleId, title, prompt, createdAt)
        VALUES (?, ?, ?, ?, ?)
      `)
      for (const task of tasks) {
        stmt.run(
          task.id ?? uuidv4(),
          ruleId,
          task.title,
          task.prompt,
          Date.now()
        )
      }
    })
    transaction()
  }

  createAutomationRun(ruleId: string, sessionId: string, taskId?: string | null, taskTitle?: string | null) {
    const stmt = this.db.prepare(`
      INSERT INTO automation_runs (id, ruleId, sessionId, taskId, taskTitle, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    stmt.run(uuidv4(), ruleId, sessionId, taskId ?? null, taskTitle ?? null, Date.now())
  }

  listAutomationRuns(ruleId: string, limit = 50): AutomationRun[] {
    const stmt = this.db.prepare(`
      SELECT r.id,
             r.ruleId,
             r.sessionId,
             r.taskId,
             r.taskTitle,
             r.createdAt,
             s.status,
             s.title,
             s.lastMessage,
             s.lastUserMessage
      FROM automation_runs r
      LEFT JOIN sessions s ON s.id = r.sessionId
      WHERE r.ruleId = ?
      ORDER BY r.createdAt DESC
      LIMIT ?
    `)
    const rows = stmt.all(ruleId, limit) as Array<{
      id: string
      ruleId: string
      sessionId: string
      taskId?: string | null
      taskTitle?: string | null
      createdAt: number
      status?: string | null
      title?: string | null
      lastMessage?: string | null
      lastUserMessage?: string | null
    }>
    return rows.map(row => ({
      id: row.id,
      ruleId: row.ruleId,
      sessionId: row.sessionId,
      runAt: row.createdAt,
      taskId: row.taskId ?? null,
      taskTitle: row.taskTitle ?? null,
      status: row.status ?? undefined,
      title: row.title ?? undefined,
      lastMessage: row.lastMessage ?? undefined,
      lastUserMessage: row.lastUserMessage ?? undefined
    }))
  }
}

let dbInstance: SqliteDb | null = null

export function getDb() {
  if (!dbInstance) {
    dbInstance = new SqliteDb()
  }
  return dbInstance
}
