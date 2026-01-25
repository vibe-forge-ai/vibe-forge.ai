export interface ClaudeCodeBaseEvent {
  uuid: string
  timestamp: string
  sessionId: string
  cwd: string
  version?: string
  gitBranch?: string
  parentUuid?: string | null
  isSidechain?: boolean
  userType?: string
}

export interface ClaudeCodeContentText {
  type: 'text'
  text: string
}

export interface ClaudeCodeContentToolUse {
  type: 'tool_use'
  id: string
  name: string
  input?: Record<string, unknown>
  args?: Record<string, unknown>
}

export interface ClaudeCodeContentToolResult {
  type: 'tool_result'
  tool_use_id: string
  content: string | unknown[]
  is_error?: boolean
}

export type ClaudeCodeContent = ClaudeCodeContentText | ClaudeCodeContentToolUse | ClaudeCodeContentToolResult

export interface ClaudeCodeUserMessage {
  id?: string
  type?: string
  role: 'user'
  content: string | ClaudeCodeContent[]
  uuid?: string
}

export interface ClaudeCodeUserEvent extends ClaudeCodeBaseEvent {
  type: 'user'
  message: ClaudeCodeUserMessage
}

export interface ClaudeCodeAssistantMessage {
  id: string
  type: 'message'
  role: 'assistant'
  content: ClaudeCodeContent[]
  model: string
  stop_reason: string | null
  stop_sequence: string | null
  usage?: {
    input_tokens: number
    output_tokens: number
    cache_read_input_tokens: number
  }
  uuid?: string
}

export interface ClaudeCodeAssistantEvent extends ClaudeCodeBaseEvent {
  type: 'assistant'
  message: ClaudeCodeAssistantMessage
  model?: string
}

export interface ClaudeCodeSystemInitEvent extends ClaudeCodeBaseEvent {
  type: 'system'
  subtype: 'init'
  model: string
  claude_code_version: string
  tools: unknown[]
  slash_commands: unknown[]
  agents: unknown[]
}

export interface ClaudeCodeSummaryEvent {
  type: 'summary'
  summary: string
  leafUuid: string
}

export type ClaudeCodeIncomingEvent =
  | ClaudeCodeUserEvent
  | ClaudeCodeAssistantEvent
  | ClaudeCodeSystemInitEvent
  | ClaudeCodeSummaryEvent
