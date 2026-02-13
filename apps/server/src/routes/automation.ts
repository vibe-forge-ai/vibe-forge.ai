import { randomUUID } from 'node:crypto'

import Router from '@koa/router'
import { parseExpression } from 'cron-parser'

import { getDb } from '#~/db.js'
import type { AutomationRule, AutomationTask, AutomationTrigger } from '#~/db.js'
import {
  initAutomationScheduler,
  removeAutomationRuleSchedule,
  runAutomationRule,
  scheduleAutomationRule
} from '#~/automation/index.js'

let schedulerReady = false

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
    const body = ctx.request.body as {
      name?: string
      description?: string
      enabled?: boolean
      immediateRun?: boolean
      triggers?: Array<Partial<AutomationTrigger>>
      tasks?: Array<Partial<AutomationTask>>
    }
    const name = (body.name ?? '').trim()
    const description = (body.description ?? '').trim()
    const enabled = body.enabled !== false
    const triggers = Array.isArray(body.triggers) ? body.triggers : []
    const tasks = Array.isArray(body.tasks) ? body.tasks : []
    const immediateRun = body.immediateRun === true

    if (name === '' || triggers.length === 0 || tasks.length === 0) {
      ctx.status = 400
      ctx.body = { error: 'Invalid payload' }
      return
    }

    const normalizedTriggers = triggers.map((trigger) => {
      const type = trigger.type === 'webhook' ? 'webhook' : trigger.type === 'cron' ? 'cron' : 'interval'
      const intervalMs = trigger.intervalMs ?? null
      const cronExpression = (trigger.cronExpression ?? '').trim()
      const webhookKey = (trigger.webhookKey ?? '').trim()

      if (type === 'interval' && (intervalMs == null || intervalMs <= 0)) {
        throw new Error('Invalid interval')
      }
      if (type === 'cron' && !isValidCron(cronExpression)) {
        throw new Error('Invalid cron expression')
      }
      return {
        id: trigger.id ?? randomUUID(),
        type,
        intervalMs: type === 'interval' ? intervalMs : null,
        cronExpression: type === 'cron' ? cronExpression : null,
        webhookKey: type === 'webhook' ? (webhookKey !== '' ? webhookKey : randomUUID()) : null
      }
    })

    const normalizedTasks = tasks.map((task, index) => {
      const title = (task.title ?? '').trim() || `任务 ${index + 1}`
      const prompt = (task.prompt ?? '').trim()
      if (prompt === '') {
        throw new Error('Invalid task prompt')
      }
      return {
        id: task.id ?? randomUUID(),
        title,
        prompt
      }
    })

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

    try {
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
    } catch (err) {
      ctx.status = 400
      ctx.body = { error: 'Invalid payload' }
    }
  })

  router.patch('/rules/:id', async (ctx) => {
    const { id } = ctx.params as { id: string }
    const existing = db.getAutomationRule(id)
    if (!existing) {
      ctx.status = 404
      ctx.body = { error: 'Rule not found' }
      return
    }
    const body = ctx.request.body as {
      name?: string
      description?: string
      enabled?: boolean
      immediateRun?: boolean
      triggers?: Array<Partial<AutomationTrigger>>
      tasks?: Array<Partial<AutomationTask>>
    }
    const updates: Partial<AutomationRule> = {}
    const immediateRun = body.immediateRun === true
    if (body.name !== undefined) updates.name = body.name.trim()
    if (body.description !== undefined) updates.description = body.description.trim()
    if (body.enabled !== undefined) updates.enabled = body.enabled

    if (updates.name !== undefined && updates.name.trim() === '') {
      ctx.status = 400
      ctx.body = { error: 'Invalid payload' }
      return
    }

    try {
      if (body.triggers) {
        if (!Array.isArray(body.triggers) || body.triggers.length === 0) {
          ctx.status = 400
          ctx.body = { error: 'Invalid payload' }
          return
        }
        const normalizedTriggers = body.triggers.map((trigger) => {
          const type = trigger.type === 'webhook' ? 'webhook' : trigger.type === 'cron' ? 'cron' : 'interval'
          const intervalMs = trigger.intervalMs ?? null
          const cronExpression = (trigger.cronExpression ?? '').trim()
          const webhookKey = (trigger.webhookKey ?? '').trim()
          if (type === 'interval' && (intervalMs == null || intervalMs <= 0)) {
            throw new Error('Invalid interval')
          }
          if (type === 'cron' && !isValidCron(cronExpression)) {
            throw new Error('Invalid cron expression')
          }
          return {
            id: trigger.id ?? randomUUID(),
            type,
            intervalMs: type === 'interval' ? intervalMs : null,
            cronExpression: type === 'cron' ? cronExpression : null,
            webhookKey: type === 'webhook' ? (webhookKey !== '' ? webhookKey : randomUUID()) : null
          }
        })
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
          ctx.status = 400
          ctx.body = { error: 'Invalid payload' }
          return
        }
        const normalizedTasks = body.tasks.map((task, index) => {
          const title = (task.title ?? '').trim() || `任务 ${index + 1}`
          const prompt = (task.prompt ?? '').trim()
          if (prompt === '') {
            throw new Error('Invalid task prompt')
          }
          return {
            id: task.id ?? randomUUID(),
            title,
            prompt
          }
        })
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
    } catch (err) {
      ctx.status = 400
      ctx.body = { error: 'Invalid payload' }
    }
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
      ctx.status = 409
      ctx.body = { error: 'Rule disabled or missing' }
      return
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
      ctx.status = 404
      ctx.body = { error: 'Trigger not found' }
      return
    }
    if (trigger.type !== 'webhook') {
      ctx.status = 400
      ctx.body = { error: 'Not a webhook trigger' }
      return
    }
    const key = (ctx.query.key as string | undefined) ?? ctx.get('x-automation-key')
    if (key == null || key !== trigger.webhookKey) {
      ctx.status = 401
      ctx.body = { error: 'Invalid key' }
      return
    }
    const result = await runAutomationRule(trigger.ruleId)
    if (!result) {
      ctx.status = 409
      ctx.body = { error: 'Rule disabled' }
      return
    }
    ctx.body = { ok: true, ...result }
  })

  return router
}
