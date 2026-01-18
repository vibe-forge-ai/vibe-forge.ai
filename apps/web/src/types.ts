export type Project = {
  id: string
  name: string
  path: string
}

export type Session = {
  id: string
  title?: string
  createdAt: number
}

export type ChatMessageContent =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: any }
  | { type: 'tool_result'; tool_use_id: string; content: any; is_error?: boolean }

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string | ChatMessageContent[]
  model?: string
  usage?: {
    input_tokens: number
    output_tokens: number
    cache_read_input_tokens?: number
    cache_creation_input_tokens?: number
  }
  toolCall?: {
    id?: string
    name: string
    args: Record<string, unknown>
    status?: 'pending' | 'success' | 'error'
    output?: unknown
  }
  createdAt: number
}

export type SessionInfo = {
  model: string
  version: string
  tools: string[]
  slashCommands: string[]
  cwd: string
  agents: string[]
} | {
  type: 'summary'
  summary: string
  leafUuid: string
}
