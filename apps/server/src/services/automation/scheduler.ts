import { parseExpression } from 'cron-parser'

import { getDb } from '#~/db/index.js'
import type { AutomationTrigger } from '#~/db/index.js'

import { ensureLegacyRuleData, runAutomationRule } from './execution'

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

export function removeAutomationRuleSchedule(ruleId: string) {
  const db = getDb()
  const triggers = db.listAutomationTriggers(ruleId)
  for (const trigger of triggers) {
    clearTimer(trigger.id)
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

export function initAutomationScheduler() {
  const db = getDb()
  const rules = db.listAutomationRules()
  for (const rule of rules) {
    scheduleAutomationRule(rule.id)
  }
}
