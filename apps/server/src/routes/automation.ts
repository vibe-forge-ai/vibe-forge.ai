import { randomUUID } from 'node:crypto'

import Router from '@koa/router'
import { parseExpression } from 'cron-parser'

import type { EffortLevel, GitBranchKind, SessionPermissionMode } from '@vibe-forge/types'

import { getDb } from '#~/db/index.js'
import type { AutomationRule, AutomationTask, AutomationTrigger } from '#~/db/index.js'
import {
  initAutomationScheduler,
  removeAutomationRuleSchedule,
  runAutomationRule,
  scheduleAutomationRule
} from '#~/services/automation/index.js'
import { badRequest, conflict, notFound, unauthorized } from '#~/utils/http.js'

let schedulerReady = false

type NormalizedAutomationTrigger = Omit<AutomationTrigger, 'ruleId' | 'createdAt'>
type NormalizedAutomationTask = Omit<AutomationTask, 'ruleId' | 'createdAt'>
type AutomationBranchMode = NonNullable<AutomationTask['branchMode']>
interface AutomationRulePayload {
  name?: string
  description?: string | null
  enabled?: boolean
  immediateRun?: boolean
  triggers?: Array<Partial<AutomationTrigger>>
  tasks?: Array<Partial<AutomationTask>>
}

const invalidPayload = () => badRequest('Invalid payload', undefined, 'invalid_payload')

const normalizeOptionalString = (value: unknown) => {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized === '' ? null : normalized
}

const normalizeEffort = (value: unknown): EffortLevel | null => {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'max' ? value : null
}

const normalizePermissionMode = (value: unknown): SessionPermissionMode | null => {
  return value === 'default' ||
      value === 'acceptEdits' ||
      value === 'plan' ||
      value === 'dontAsk' ||
      value === 'bypassPermissions'
    ? value
    : null
}

const normalizeBranchKind = (value: unknown): GitBranchKind | null => {
  return value === 'local' || value === 'remote' ? value : null
}

const normalizeBranchMode = (value: unknown): AutomationBranchMode | null => {
  return value === 'checkout' || value === 'create' ? value : null
}

const normalizeCreateWorktree = (value: unknown) => {
  return typeof value === 'boolean' ? value : null
}

const normalizeTaskLaunchOptions = (task: Partial<AutomationTask>) => {
  const branchName = normalizeOptionalString(task.branchName)
  const branchMode = normalizeBranchMode(task.branchMode)
  const normalizedBranchMode = branchName == null ? null : branchMode ?? 'checkout'

  return {
    model: normalizeOptionalString(task.model),
    adapter: normalizeOptionalString(task.adapter),
    effort: normalizeEffort(task.effort),
    permissionMode: normalizePermissionMode(task.permissionMode),
    createWorktree: normalizeCreateWorktree(task.createWorktree),
    branchName,
    branchMode: normalizedBranchMode,
    branchKind: branchName == null || normalizedBranchMode === 'create'
      ? null
      : normalizeBranchKind(task.branchKind) ?? 'local'
  }
}

const normalizeTrigger = (
  trigger: Partial<AutomationTrigger>,
  isValidCron: (expression?: string | null) => boolean
): NormalizedAutomationTrigger => {
  const type: AutomationTrigger['type'] = trigger.type === 'webhook'
    ? 'webhook'
    : trigger.type === 'cron'
    ? 'cron'
    : 'interval'
  const intervalMs = trigger.intervalMs ?? null
  const cronExpression = (trigger.cronExpression ?? '').trim()
  const webhookKey = (trigger.webhookKey ?? '').trim()

  if (type === 'interval' && (intervalMs == null || intervalMs <= 0)) {
    throw badRequest('Invalid interval', undefined, 'invalid_interval')
  }
  if (type === 'cron' && !isValidCron(cronExpression)) {
    throw badRequest('Invalid cron expression', undefined, 'invalid_cron_expression')
  }

  return {
    id: trigger.id ?? randomUUID(),
    type,
    intervalMs: type === 'interval' ? intervalMs : null,
    cronExpression: type === 'cron' ? cronExpression : null,
    webhookKey: type === 'webhook' ? (webhookKey !== '' ? webhookKey : randomUUID()) : null
  }
}

const normalizeTask = (task: Partial<AutomationTask>, index: number): NormalizedAutomationTask => {
  const title = (task.title ?? '').trim() || `任务 ${index + 1}`
  const prompt = (task.prompt ?? '').trim()
  if (prompt === '') {
    throw badRequest('Invalid task prompt', undefined, 'invalid_task_prompt')
  }
  return {
    id: task.id ?? randomUUID(),
    title,
    prompt,
    ...normalizeTaskLaunchOptions(task)
  }
}

export function automationRouter(): Router {
  const router = new Router()
  const db = getDb()

  if (!schedulerReady) {
    initAutomationScheduler()
    schedulerReady = true
  }

  const isValidCron = (expression?: string | null) => {
    if (!expression) return false
    try {
      parseExpression(expression)
      return true
    } catch {
      return false
    }
  }

  router.get('/rules', (ctx) => {
    ctx.body = { rules: db.listAutomationRuleDetails() }
  })

  router.post('/rules', async (ctx) => {
    const body = ctx.request.body as AutomationRulePayload
    const name = (body.name ?? '').trim()
    const description = (body.description ?? '').trim()
    const enabled = body.enabled !== false
    const triggers = Array.isArray(body.triggers) ? body.triggers : []
    const tasks = Array.isArray(body.tasks) ? body.tasks : []
    const immediateRun = body.immediateRun === true

    if (name === '' || triggers.length === 0 || tasks.length === 0) {
      throw invalidPayload()
    }

    const normalizedTriggers = triggers.map(trigger => normalizeTrigger(trigger, isValidCron))
    const normalizedTasks = tasks.map((task, index) => normalizeTask(task, index))

    const primaryTrigger = normalizedTriggers[0]
    const primaryTask = normalizedTasks[0]
    const rule: AutomationRule = {
      id: randomUUID(),
      name,
      description: description === '' ? null : description,
      type: primaryTrigger?.type ?? 'interval',
      intervalMs: primaryTrigger?.intervalMs ?? null,
      webhookKey: primaryTrigger?.webhookKey ?? null,
      cronExpression: primaryTrigger?.cronExpression ?? null,
      prompt: primaryTask?.prompt ?? '',
      enabled,
      createdAt: Date.now(),
      lastRunAt: null,
      lastSessionId: null
    }
    db.createAutomationRule(rule)
    db.replaceAutomationTriggers(rule.id, normalizedTriggers)
    db.replaceAutomationTasks(rule.id, normalizedTasks)
    if (enabled) {
      scheduleAutomationRule(rule.id)
    }
    const detail = db.getAutomationRuleDetail(rule.id)
    if (immediateRun) {
      await runAutomationRule(rule.id, { ignoreEnabled: true })
    }
    ctx.body = { rule: detail }
  })

  router.patch('/rules/:id', async (ctx) => {
    const { id } = ctx.params as { id: string }
    const existing = db.getAutomationRule(id)
    if (!existing) {
      throw notFound('Rule not found', { id }, 'rule_not_found')
    }
    const body = ctx.request.body as AutomationRulePayload
    const updates: Partial<AutomationRule> = {}
    const immediateRun = body.immediateRun === true
    if (body.name !== undefined) updates.name = body.name.trim()
    if (body.description !== undefined) updates.description = body.description?.trim() ?? null
    if (body.enabled !== undefined) updates.enabled = body.enabled

    if (updates.name !== undefined && updates.name.trim() === '') {
      throw invalidPayload()
    }

    if (body.triggers) {
      if (!Array.isArray(body.triggers) || body.triggers.length === 0) {
        throw invalidPayload()
      }
      const normalizedTriggers = body.triggers.map(trigger => normalizeTrigger(trigger, isValidCron))
      const primaryTrigger = normalizedTriggers[0]
      updates.type = primaryTrigger?.type ?? updates.type ?? existing.type
      updates.intervalMs = primaryTrigger?.intervalMs ?? null
      updates.webhookKey = primaryTrigger?.webhookKey ?? null
      updates.cronExpression = primaryTrigger?.cronExpression ?? null
      removeAutomationRuleSchedule(id)
      db.replaceAutomationTriggers(id, normalizedTriggers)
    }

    if (body.tasks) {
      if (!Array.isArray(body.tasks) || body.tasks.length === 0) {
        throw invalidPayload()
      }
      const normalizedTasks = body.tasks.map((task, index) => normalizeTask(task, index))
      const primaryTask = normalizedTasks[0]
      updates.prompt = primaryTask?.prompt ?? updates.prompt ?? existing.prompt
      db.replaceAutomationTasks(id, normalizedTasks)
    }

    db.updateAutomationRule(id, updates)
    const updated = db.getAutomationRule(id)
    if (updated?.enabled) {
      scheduleAutomationRule(id)
    }
    if (immediateRun) {
      await runAutomationRule(id, { ignoreEnabled: true })
    }
    ctx.body = { rule: db.getAutomationRuleDetail(id) }
  })

  router.delete('/rules/:id', (ctx) => {
    const { id } = ctx.params as { id: string }
    const removed = db.deleteAutomationRule(id)
    if (removed) {
      removeAutomationRuleSchedule(id)
    }
    ctx.body = { ok: true, removed }
  })

  router.post('/rules/:id/run', async (ctx) => {
    const { id } = ctx.params as { id: string }
    const result = await runAutomationRule(id)
    if (!result) {
      throw conflict('Rule disabled or missing', { id }, 'rule_unavailable')
    }
    ctx.body = { ok: true, ...result }
  })

  router.get('/rules/:id/runs', (ctx) => {
    const { id } = ctx.params as { id: string }
    const { limit } = ctx.query as { limit?: string }
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 50
    const safeLimit = Number.isNaN(parsedLimit) ? 50 : Math.min(Math.max(parsedLimit, 1), 200)
    ctx.body = { runs: db.listAutomationRuns(id, safeLimit) }
  })

  router.post('/webhook/:id', async (ctx) => {
    const { id } = ctx.params as { id: string }
    const trigger = db.getAutomationTrigger(id)
    if (!trigger) {
      throw notFound('Trigger not found', { id }, 'trigger_not_found')
    }
    if (trigger.type !== 'webhook') {
      throw badRequest('Not a webhook trigger', { id }, 'invalid_trigger_type')
    }
    const key = (ctx.query.key as string | undefined) ?? ctx.get('x-automation-key')
    if (key == null || key !== trigger.webhookKey) {
      throw unauthorized('Invalid key', { id }, 'invalid_webhook_key')
    }
    const result = await runAutomationRule(trigger.ruleId)
    if (!result) {
      throw conflict('Rule disabled', { ruleId: trigger.ruleId }, 'rule_disabled')
    }
    ctx.body = { ok: true, ...result }
  })

  return router
}
