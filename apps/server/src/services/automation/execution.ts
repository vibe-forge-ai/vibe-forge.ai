import { getDb } from '#~/db/index.js'
import type { AutomationRule } from '#~/db/index.js'
import { createSessionWithInitialMessage } from '#~/services/session/create.js'

export function ensureLegacyRuleData(rule: AutomationRule) {
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

  const sessions = await Promise.all(tasks.map(task =>
    createSessionWithInitialMessage({
      title: task.title ? `自动化任务: ${rule.name} · ${task.title}` : `自动化任务: ${rule.name}`,
      initialMessage: task.prompt,
      tags: [`automation:${rule.id}:${rule.name}`]
    })
  ))

  const sessionIds = sessions.map((session: Awaited<ReturnType<typeof createSessionWithInitialMessage>>) => session.id)
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
