interface InteractionOption {
  label: string
  value?: string
  description?: string
}

export interface PermissionInteractionContext {
  adapter?: string
  currentMode?: 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions'
  suggestedMode?: 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions'
  deniedTools?: string[]
  reasons?: string[]
}

export interface AskUserQuestionParams {
  sessionId: string
  question: string
  options?: InteractionOption[]
  multiselect?: boolean
  kind?: 'question' | 'permission'
  permissionContext?: PermissionInteractionContext
}
