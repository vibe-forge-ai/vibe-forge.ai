interface InteractionOption {
  label: string
  value?: string
  description?: string
}

export type PermissionInteractionDecision =
  | 'allow_once'
  | 'allow_session'
  | 'allow_project'
  | 'deny_once'
  | 'deny_session'
  | 'deny_project'

export interface PermissionInteractionContext {
  adapter?: string
  currentMode?: 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions'
  suggestedMode?: 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions'
  deniedTools?: string[]
  reasons?: string[]
  subjectKey?: string
  subjectLookupKeys?: string[]
  subjectLabel?: string
  scope?: 'tool'
  projectConfigPath?: string
}

export interface AskUserQuestionParams {
  sessionId: string
  question: string
  options?: InteractionOption[]
  multiselect?: boolean
  kind?: 'question' | 'permission'
  permissionContext?: PermissionInteractionContext
}
