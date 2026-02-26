import { createApiUrl, fetchApiJson, jsonHeaders } from './base'

export interface AutomationTrigger {
  id: string
  type: 'interval' | 'webhook' | 'cron'
  intervalMs?: number | null
  cronExpression?: string | null
  webhookKey?: string | null
}

export interface AutomationTask {
  id: string
  title: string
  prompt: string
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
  triggers?: AutomationTrigger[]
  tasks?: AutomationTask[]
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

export async function listAutomationRules(): Promise<{ rules: AutomationRule[] }> {
  return fetchApiJson<{ rules: AutomationRule[] }>('/api/automation/rules')
}

export async function createAutomationRule(
  rule: Partial<AutomationRule> & { immediateRun?: boolean }
): Promise<{ rule: AutomationRule }> {
  return fetchApiJson<{ rule: AutomationRule }>('/api/automation/rules', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(rule)
  })
}

export async function updateAutomationRule(
  id: string,
  rule: Partial<AutomationRule> & { immediateRun?: boolean }
): Promise<{ rule: AutomationRule }> {
  return fetchApiJson<{ rule: AutomationRule }>(`/api/automation/rules/${id}`, {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify(rule)
  })
}

export async function deleteAutomationRule(id: string): Promise<{ ok: boolean; removed: boolean }> {
  return fetchApiJson<{ ok: boolean; removed: boolean }>(`/api/automation/rules/${id}`, {
    method: 'DELETE'
  })
}

export async function runAutomationRule(id: string): Promise<{ ok: boolean; sessionIds: string[] }> {
  return fetchApiJson<{ ok: boolean; sessionIds: string[] }>(`/api/automation/rules/${id}/run`, {
    method: 'POST'
  })
}

export async function listAutomationRuns(id: string, limit = 50): Promise<{ runs: AutomationRun[] }> {
  const url = createApiUrl(`/api/automation/rules/${id}/runs`)
  url.searchParams.set('limit', limit.toString())
  return fetchApiJson<{ runs: AutomationRun[] }>(url)
}
