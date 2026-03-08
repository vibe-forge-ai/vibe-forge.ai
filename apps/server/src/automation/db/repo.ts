import type Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'

import type {
  AutomationRule,
  AutomationRuleDetail,
  AutomationRun,
  AutomationTask,
  AutomationTrigger
} from './types.js'

export function createAutomationRepo(db: Database.Database) {
  const listAutomationRules = (): AutomationRule[] => {
    const stmt = db.prepare('SELECT * FROM automation_rules ORDER BY createdAt DESC')
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

  const listAutomationRuleDetails = (): AutomationRuleDetail[] => {
    const rules = listAutomationRules()
    const triggerRows = db.prepare('SELECT * FROM automation_triggers').all() as Array<{
      id: string
      ruleId: string
      type: string
      intervalMs: number | null
      cronExpression: string | null
      webhookKey: string | null
      createdAt: number
    }>
    const taskRows = db.prepare('SELECT * FROM automation_tasks').all() as Array<{
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

  const getAutomationRule = (id: string): AutomationRule | undefined => {
    const stmt = db.prepare('SELECT * FROM automation_rules WHERE id = ?')
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

  const listAutomationTriggers = (ruleId: string): AutomationTrigger[] => {
    const stmt = db.prepare('SELECT * FROM automation_triggers WHERE ruleId = ? ORDER BY createdAt ASC')
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

  const listAutomationTasks = (ruleId: string): AutomationTask[] => {
    const stmt = db.prepare('SELECT * FROM automation_tasks WHERE ruleId = ? ORDER BY createdAt ASC')
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

  const getAutomationRuleDetail = (id: string): AutomationRuleDetail | undefined => {
    const rule = getAutomationRule(id)
    if (!rule) return undefined
    return {
      ...rule,
      triggers: listAutomationTriggers(id),
      tasks: listAutomationTasks(id)
    }
  }

  const createAutomationRule = (rule: AutomationRule) => {
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

  const updateAutomationRule = (id: string, updates: Partial<Omit<AutomationRule, 'id' | 'createdAt'>>) => {
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
    const stmt = db.prepare(queryStr)
    stmt.run(...params)
  }

  const deleteAutomationRule = (id: string): boolean => {
    const stmt = db.prepare('DELETE FROM automation_rules WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }

  const getAutomationTrigger = (id: string): AutomationTrigger | undefined => {
    const stmt = db.prepare('SELECT * FROM automation_triggers WHERE id = ?')
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

  const replaceAutomationTriggers = (
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

  const replaceAutomationTasks = (
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

  const createAutomationRun = (ruleId: string, sessionId: string, taskId?: string | null, taskTitle?: string | null) => {
    const stmt = db.prepare(`
      INSERT INTO automation_runs (id, ruleId, sessionId, taskId, taskTitle, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    stmt.run(uuidv4(), ruleId, sessionId, taskId ?? null, taskTitle ?? null, Date.now())
  }

  const listAutomationRuns = (ruleId: string, limit = 50): AutomationRun[] => {
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
    createAutomationRule,
    createAutomationRun,
    deleteAutomationRule,
    getAutomationRule,
    getAutomationRuleDetail,
    getAutomationTrigger,
    listAutomationRuleDetails,
    listAutomationRules,
    listAutomationRuns,
    listAutomationTasks,
    listAutomationTriggers,
    replaceAutomationTasks,
    replaceAutomationTriggers,
    updateAutomationRule
  }
}

export type AutomationRepo = ReturnType<typeof createAutomationRepo>
