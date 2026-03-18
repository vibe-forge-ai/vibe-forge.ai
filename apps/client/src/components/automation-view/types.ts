export type RuleFormValues = {
  name: string
  description?: string
  enabled: boolean
  immediateRun: boolean
  triggers: Array<{
    id?: string
    type: 'interval' | 'webhook' | 'cron'
    intervalMinutes?: number
    webhookKey?: string
    cronExpression?: string
    cronPreset?: string
    weeklyDay?: string
    weeklyTime?: string
  }>
  tasks: Array<{
    id?: string
    title?: string
    prompt: string
  }>
}
