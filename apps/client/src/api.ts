import type { ConfigResponse, ConfigSource, Session } from '@vibe-forge/core'

export interface SpecSummary {
  id: string
  name: string
  description: string
  params: { name: string; description?: string }[]
  always: boolean
  tags: string[]
  skills: string[]
  rules: string[]
}

export interface EntitySummary {
  id: string
  name: string
  description: string
  always: boolean
  tags: string[]
  skills: string[]
  rules: string[]
}

export interface RuleSummary {
  id: string
  name: string
  description: string
  always: boolean
  globs?: string[]
}

export interface SpecDetail extends SpecSummary {
  body: string
}

export interface EntityDetail extends EntitySummary {
  body: string
}

export interface RuleDetail extends RuleSummary {
  body: string
}

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

const SERVER_HOST = (import.meta.env.__VF_PROJECT_AI_SERVER_HOST__ as string | undefined) ?? window.location.hostname
const SERVER_PORT = (import.meta.env.__VF_PROJECT_AI_SERVER_PORT__ as string | undefined) ?? '8787'
const SERVER_URL = `http://${SERVER_HOST}:${SERVER_PORT}`

export async function listProjects(): Promise<any> {
  const res = await fetch(`${SERVER_URL}/api/projects`)
  return res.json()
}

export async function createProject(name?: string): Promise<any> {
  const res = await fetch(`${SERVER_URL}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
  return res.json()
}

export async function listSessions(filter: 'active' | 'archived' | 'all' = 'active'): Promise<{ sessions: Session[] }> {
  const res = await fetch(`${SERVER_URL}/api/sessions${filter === 'archived' ? '/archived' : ''}`)
  return res.json() as Promise<{ sessions: Session[] }>
}

export async function createSession(
  title?: string,
  initialMessage?: string,
  model?: string
): Promise<{ session: Session }> {
  const res = await fetch(`${SERVER_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, initialMessage, model })
  })
  return res.json() as Promise<{ session: Session }>
}

export async function listSpecs(): Promise<{ specs: SpecSummary[] }> {
  const res = await fetch(`${SERVER_URL}/api/ai/specs`)
  return res.json() as Promise<{ specs: SpecSummary[] }>
}

export async function listEntities(): Promise<{ entities: EntitySummary[] }> {
  const res = await fetch(`${SERVER_URL}/api/ai/entities`)
  return res.json() as Promise<{ entities: EntitySummary[] }>
}

export async function listRules(): Promise<{ rules: RuleSummary[] }> {
  const res = await fetch(`${SERVER_URL}/api/ai/rules`)
  return res.json() as Promise<{ rules: RuleSummary[] }>
}

export async function getSpecDetail(path: string): Promise<{ spec: SpecDetail }> {
  const url = new URL(`${SERVER_URL}/api/ai/specs/detail`)
  url.searchParams.set('path', path)
  const res = await fetch(url.toString())
  return res.json() as Promise<{ spec: SpecDetail }>
}

export async function getEntityDetail(path: string): Promise<{ entity: EntityDetail }> {
  const url = new URL(`${SERVER_URL}/api/ai/entities/detail`)
  url.searchParams.set('path', path)
  const res = await fetch(url.toString())
  return res.json() as Promise<{ entity: EntityDetail }>
}

export async function getRuleDetail(path: string): Promise<{ rule: RuleDetail }> {
  const url = new URL(`${SERVER_URL}/api/ai/rules/detail`)
  url.searchParams.set('path', path)
  const res = await fetch(url.toString())
  return res.json() as Promise<{ rule: RuleDetail }>
}

export async function getConfig(): Promise<ConfigResponse> {
  const res = await fetch(`${SERVER_URL}/api/config`)
  return res.json() as Promise<ConfigResponse>
}

export async function listAutomationRules(): Promise<{ rules: AutomationRule[] }> {
  const res = await fetch(`${SERVER_URL}/api/automation/rules`)
  return res.json() as Promise<{ rules: AutomationRule[] }>
}

export async function createAutomationRule(rule: Partial<AutomationRule> & { immediateRun?: boolean }): Promise<{ rule: AutomationRule }> {
  const res = await fetch(`${SERVER_URL}/api/automation/rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rule)
  })
  return res.json() as Promise<{ rule: AutomationRule }>
}

export async function updateAutomationRule(
  id: string,
  rule: Partial<AutomationRule> & { immediateRun?: boolean }
): Promise<{ rule: AutomationRule }> {
  const res = await fetch(`${SERVER_URL}/api/automation/rules/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rule)
  })
  return res.json() as Promise<{ rule: AutomationRule }>
}

export async function deleteAutomationRule(id: string): Promise<{ ok: boolean; removed: boolean }> {
  const res = await fetch(`${SERVER_URL}/api/automation/rules/${id}`, {
    method: 'DELETE'
  })
  return res.json() as Promise<{ ok: boolean; removed: boolean }>
}

export async function runAutomationRule(id: string): Promise<{ ok: boolean; sessionIds: string[] }> {
  const res = await fetch(`${SERVER_URL}/api/automation/rules/${id}/run`, {
    method: 'POST'
  })
  return res.json() as Promise<{ ok: boolean; sessionIds: string[] }>
}

export async function listAutomationRuns(id: string, limit = 50): Promise<{ runs: AutomationRun[] }> {
  const url = new URL(`${SERVER_URL}/api/automation/rules/${id}/runs`)
  url.searchParams.set('limit', limit.toString())
  const res = await fetch(url.toString())
  return res.json() as Promise<{ runs: AutomationRun[] }>
}

export async function updateConfig(
  source: ConfigSource,
  section: string,
  value: unknown
): Promise<{ ok: boolean }> {
  const res = await fetch(`${SERVER_URL}/api/config`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, section, value })
  })
  if (!res.ok) {
    const text = await res.text()
    console.error('[api] update config failed:', res.status, text)
    throw new Error(`Update config failed: ${res.status} ${text}`)
  }
  return res.json() as Promise<{ ok: boolean }>
}

export async function deleteSession(id: string): Promise<{ success: boolean }> {
  const url = `${SERVER_URL}/api/sessions/${id}`
  const res = await fetch(url, { method: 'DELETE' })
  if (!res.ok) {
    const text = await res.text()
    console.error('[api] delete failed:', res.status, text)
    throw new Error(`Delete failed: ${res.status} ${text}`)
  }
  return res.json() as Promise<{ success: boolean }>
}

export async function updateSession(id: string, data: Partial<Session>): Promise<{ ok: boolean }> {
  const res = await fetch(`${SERVER_URL}/api/sessions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  return res.json() as Promise<{ ok: boolean }>
}

export async function updateSessionTitle(id: string, title: string): Promise<{ session: Session }> {
  const res = await fetch(`${SERVER_URL}/api/sessions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  })
  return res.json() as Promise<{ session: Session }>
}

export async function getSessionMessages(
  id: string,
  limit?: number
): Promise<{ messages: any[]; session?: Session; interaction?: { id: string; payload: any } }> {
  const url = new URL(`${SERVER_URL}/api/sessions/${id}/messages`)
  if (limit != null) {
    url.searchParams.set('limit', limit.toString())
  }
  const res = await fetch(url.toString())
  return res.json() as Promise<{ messages: any[]; session?: Session; interaction?: { id: string; payload: any } }>
}
