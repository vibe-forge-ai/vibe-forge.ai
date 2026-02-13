import { parseExpression } from 'cron-parser'

import { getDb } from '#~/db.js'
import type { AutomationRule, AutomationTrigger } from '#~/db.js'
import { createSessionWithInitialMessage } from '#~/services/sessionCreate.js'

const timers = new Map<string, NodeJS.Timeout>()

function clearTimer(triggerId: string) {
  const timer = timers.get(triggerId)
  if (timer) {
    clearTimeout(timer)
    timers.delete(triggerId)
  }
}

function hasValidInterval(trigger: AutomationTrigger) {
  return trigger.intervalMs != null && trigger.intervalMs > 0
}

function hasValidCron(trigger: AutomationTrigger) {
  if (!trigger.cronExpression) return false
  try {
    parseExpression(trigger.cronExpression)
    return true
  } catch {
    return false
  }
}

function getNextCronTime(trigger: AutomationTrigger): number | null {
  if (!trigger.cronExpression) return null
  const expression = parseExpression(trigger.cronExpression, { currentDate: new Date() })
  return expression.next().toDate().getTime()
}

function scheduleCronTrigger(ruleId: string, triggerId: string) {
  clearTimer(triggerId)
  const db = getDb()
  const rule = db.getAutomationRule(ruleId)
  const trigger = db.getAutomationTrigger(triggerId)
  if (!rule || !rule.enabled || !trigger || trigger.type !== 'cron' || !hasValidCron(trigger)) return
  const nextTime = getNextCronTime(trigger)
  if (!nextTime) return
  const delay = Math.max(nextTime - Date.now(), 1000)
  const timer = setTimeout(async () => {
    try {
      await runAutomationRule(ruleId)
    } finally {
      scheduleCronTrigger(ruleId, triggerId)
    }
  }, delay)
  timers.set(triggerId, timer)
}

function scheduleIntervalTrigger(ruleId: string, trigger: AutomationTrigger) {
  clearTimer(trigger.id)
  if (!hasValidInterval(trigger)) return
  const timer = setInterval(async () => {
    const db = getDb()
    const rule = db.getAutomationRule(ruleId)
    if (!rule || !rule.enabled) return
    const triggerCheck = db.getAutomationTrigger(trigger.id)
    if (!triggerCheck || triggerCheck.type !== 'interval') return
    if (!hasValidInterval(triggerCheck)) return
    await runAutomationRule(ruleId)
  }, trigger.intervalMs ?? 0)
  timers.set(trigger.id, timer)
}

function ensureLegacyRuleData(rule: AutomationRule) {
  const db = getDb()
  const triggers = db.listAutomationTriggers(rule.id)
  const tasks = db.listAutomationTasks(rule.id)
  if (triggers.length === 0) {
    db.replaceAutomationTriggers(rule.id, [{
      type: rule.type,
      intervalMs: rule.intervalMs ?? null,
      cronExpression: rule.cronExpression ?? null,
      webhookKey: rule.webhookKey ?? null
    }])
  }
  if (tasks.length === 0 && rule.prompt && rule.prompt.trim() !== '') {
    db.replaceAutomationTasks(rule.id, [{
      title: rule.name,
      prompt: rule.prompt
    }])
  }
}

export function scheduleAutomationRule(ruleId: string) {
  removeAutomationRuleSchedule(ruleId)
  const db = getDb()
  const rule = db.getAutomationRule(ruleId)
  if (!rule || !rule.enabled) return
  ensureLegacyRuleData(rule)
  const triggers = db.listAutomationTriggers(ruleId)
  for (const trigger of triggers) {
    if (trigger.type === 'interval') {
      scheduleIntervalTrigger(ruleId, trigger)
    }
    if (trigger.type === 'cron') {
      scheduleCronTrigger(ruleId, trigger.id)
    }
  }
}

export function removeAutomationRuleSchedule(ruleId: string) {
  const db = getDb()
  const triggers = db.listAutomationTriggers(ruleId)
  for (const trigger of triggers) {
    clearTimer(trigger.id)
  }
}

export function initAutomationScheduler() {
  const db = getDb()
  const rules = db.listAutomationRules()
  for (const rule of rules) {
    scheduleAutomationRule(rule.id)
  }
}

export async function runAutomationRule(
  id: string,
  options?: { ignoreEnabled?: boolean }
): Promise<{ sessionIds: string[] } | null> {
  const db = getDb()
  const rule = db.getAutomationRule(id)
  if (!rule) return null
  if (!rule.enabled && !options?.ignoreEnabled) return null
  ensureLegacyRuleData(rule)
  const runAt = Date.now()
  const tasks = db.listAutomationTasks(id)
  if (tasks.length === 0) return null
  const sessions = await Promise.all(tasks.map(task => createSessionWithInitialMessage({
    title: task.title ? `自动化任务: ${rule.name} · ${task.title}` : `自动化任务: ${rule.name}`,
    initialMessage: task.prompt,
    tags: [`automation:${rule.id}:${rule.name}`]
  })))
  const sessionIds = sessions.map(session => session.id)
  for (let index = 0; index < sessions.length; index += 1) {
    const session = sessions[index]
    const task = tasks[index]
    if (!session || !task) continue
    db.createAutomationRun(rule.id, session.id, task.id, task.title)
  }
  db.updateAutomationRule(id, {
    lastRunAt: runAt,
    lastSessionId: sessionIds[0] ?? null
  })
  return { sessionIds }
}
