export interface ClaudeBashToolInput {
  command?: string
  timeout?: number
  description?: string
  reason?: string
  thought?: string
  run_in_background?: boolean
  dangerouslyDisableSandbox?: boolean
}

export interface ClaudeGlobToolInput {
  pattern?: string
  path?: string
}

export interface ClaudeLSToolInput {
  path?: string
  ignore?: string[]
}

export interface ClaudeReadToolInput {
  file_path?: string
  offset?: number
  limit?: number
}

export interface ClaudeWriteToolInput {
  file_path?: string
  content?: string
}

export interface ClaudeTodoItem {
  id?: string
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  priority?: string
  activeForm?: string
}

export interface ClaudeTodoWriteToolInput {
  todos?: ClaudeTodoItem[]
}
