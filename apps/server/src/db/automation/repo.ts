import { v4 as uuidv4 } from 'uuid'

import { buildUpdateStatement } from '../repo.utils'
import type { SqliteDatabase } from '../sqlite'

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

interface AutomationRuleRow {
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
}

interface AutomationTriggerRow {
  id: string
  ruleId: string
  type: string
  intervalMs: number | null
  cronExpression: string | null
  webhookKey: string | null
  createdAt: number
}

interface AutomationTaskRow {
  id: string
  ruleId: string
  title: string
  prompt: string
  createdAt: number
}

type AutomationRuleUpdate = Partial<Omit<AutomationRule, 'id' | 'createdAt'>>

const automationRuleUpdateFields = [
  { key: 'name' },
  { key: 'description', toParam: value => value ?? null },
  { key: 'type' },
  { key: 'intervalMs', toParam: value => value ?? null },
  { key: 'webhookKey', toParam: value => value ?? null },
  { key: 'cronExpression', toParam: value => value ?? null },
  { key: 'prompt' },
  { key: 'enabled', toParam: value => value ? 1 : 0 },
  { key: 'lastRunAt', toParam: value => value ?? null },
  { key: 'lastSessionId', toParam: value => value ?? null }
] as const satisfies ReadonlyArray<{
  key: keyof AutomationRuleUpdate
  toParam?: (value: any) => string | number | null
}>

function mapAutomationType(value: string): AutomationRule['type'] {
  return value === 'webhook' ? 'webhook' : value === 'cron' ? 'cron' : 'interval'
}

function mapAutomationRuleRow(row: AutomationRuleRow): AutomationRule {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    type: mapAutomationType(row.type),
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

function mapAutomationTriggerRow(row: AutomationTriggerRow): AutomationTrigger {
  return {
    id: row.id,
    ruleId: row.ruleId,
    type: mapAutomationType(row.type),
    intervalMs: row.intervalMs ?? null,
    cronExpression: row.cronExpression ?? null,
    webhookKey: row.webhookKey ?? null,
    createdAt: row.createdAt
  }
}

function mapAutomationTaskRow(row: AutomationTaskRow): AutomationTask {
  return {
    id: row.id,
    ruleId: row.ruleId,
    title: row.title,
    prompt: row.prompt,
    createdAt: row.createdAt
  }
}

export function createAutomationRepo(db: SqliteDatabase) {
  const listRules = (): AutomationRule[] => {
    const stmt = db.prepare('SELECT * FROM automation_rules ORDER BY createdAt DESC')
    const rows = stmt.all() as AutomationRuleRow[]
    return rows.map(mapAutomationRuleRow)
  }

  const listRuleDetails = (): AutomationRuleDetail[] => {
    const rules = listRules()
    const triggerRows = db.prepare('SELECT * FROM automation_triggers').all() as AutomationTriggerRow[]
    const taskRows = db.prepare('SELECT * FROM automation_tasks').all() as AutomationTaskRow[]
    const triggerMap = new Map<string, AutomationTrigger[]>()
    const taskMap = new Map<string, AutomationTask[]>()
    for (const row of triggerRows) {
      const list = triggerMap.get(row.ruleId) ?? []
      list.push(mapAutomationTriggerRow(row))
      triggerMap.set(row.ruleId, list)
    }
    for (const row of taskRows) {
      const list = taskMap.get(row.ruleId) ?? []
      list.push(mapAutomationTaskRow(row))
      taskMap.set(row.ruleId, list)
    }
    return rules.map(rule => ({
      ...rule,
      triggers: triggerMap.get(rule.id) ?? [],
      tasks: taskMap.get(rule.id) ?? []
    }))
  }

  const getRule = (id: string): AutomationRule | undefined => {
    const stmt = db.prepare('SELECT * FROM automation_rules WHERE id = ?')
    const row = stmt.get(id) as AutomationRuleRow | undefined
    if (row == null) return undefined
    return mapAutomationRuleRow(row)
  }

  const listTriggers = (ruleId: string): AutomationTrigger[] => {
    const stmt = db.prepare('SELECT * FROM automation_triggers WHERE ruleId = ? ORDER BY createdAt ASC')
    const rows = stmt.all(ruleId) as AutomationTriggerRow[]
    return rows.map(mapAutomationTriggerRow)
  }

  const listTasks = (ruleId: string): AutomationTask[] => {
    const stmt = db.prepare('SELECT * FROM automation_tasks WHERE ruleId = ? ORDER BY createdAt ASC')
    const rows = stmt.all(ruleId) as AutomationTaskRow[]
    return rows.map(mapAutomationTaskRow)
  }

  const getRuleDetail = (id: string): AutomationRuleDetail | undefined => {
    const rule = getRule(id)
    if (!rule) return undefined
    return {
      ...rule,
      triggers: listTriggers(id),
      tasks: listTasks(id)
    }
  }

  const createRule = (rule: AutomationRule) => {
    const stmt = db.prepare(`
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

  const updateRule = (id: string, updates: AutomationRuleUpdate) => {
    const statement = buildUpdateStatement('automation_rules', 'id', id, updates, automationRuleUpdateFields)
    if (!statement) return

    const stmt = db.prepare(statement.sql)
    stmt.run(...statement.params)
  }

  const removeRule = (id: string): boolean => {
    const stmt = db.prepare('DELETE FROM automation_rules WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }

  const getTrigger = (id: string): AutomationTrigger | undefined => {
    const stmt = db.prepare('SELECT * FROM automation_triggers WHERE id = ?')
    const row = stmt.get(id) as AutomationTriggerRow | undefined
    if (!row) return undefined
    return mapAutomationTriggerRow(row)
  }

  const replaceTriggers = (
    ruleId: string,
    triggers: Array<Omit<AutomationTrigger, 'id' | 'ruleId' | 'createdAt'> & { id?: string }>
  ) => {
    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM automation_triggers WHERE ruleId = ?').run(ruleId)
      const stmt = db.prepare(`
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

  const replaceTasks = (
    ruleId: string,
    tasks: Array<Omit<AutomationTask, 'id' | 'ruleId' | 'createdAt'> & { id?: string }>
  ) => {
    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM automation_tasks WHERE ruleId = ?').run(ruleId)
      const stmt = db.prepare(`
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

  const createRun = (
    ruleId: string,
    sessionId: string,
    taskId?: string | null,
    taskTitle?: string | null
  ) => {
    const stmt = db.prepare(`
      INSERT INTO automation_runs (id, ruleId, sessionId, taskId, taskTitle, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    stmt.run(uuidv4(), ruleId, sessionId, taskId ?? null, taskTitle ?? null, Date.now())
  }

  const listRuns = (ruleId: string, limit = 50): AutomationRun[] => {
    const stmt = db.prepare(`
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

  return {
    createRule,
    createRun,
    getRule,
    getRuleDetail,
    getTrigger,
    listRuleDetails,
    listRules,
    listRuns,
    listTasks,
    listTriggers,
    removeRule,
    replaceTasks,
    replaceTriggers,
    updateRule
  }
}

export type AutomationRepo = ReturnType<typeof createAutomationRepo>
