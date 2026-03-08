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
