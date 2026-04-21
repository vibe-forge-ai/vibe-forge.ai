import type { EffortLevel, GitBranchKind, SessionPermissionMode } from '@vibe-forge/types'

export type AutomationCreateWorktreeMode = 'default' | 'managed' | 'local'
export type AutomationBranchAction = 'default' | 'checkout' | 'create'

export interface RuleFormValues {
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
    model?: string
    adapter?: string
    effort?: EffortLevel | 'default'
    permissionMode?: SessionPermissionMode | 'default'
    createWorktreeMode?: AutomationCreateWorktreeMode
    branchAction?: AutomationBranchAction
    branchName?: string
    branchKind?: GitBranchKind
  }>
}
