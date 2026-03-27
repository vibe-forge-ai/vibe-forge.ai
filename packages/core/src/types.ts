import type { z } from 'zod'
import type { AskUserQuestionParamsSchema, InteractionOptionSchema } from './schema.js'

export interface Project {
  id: string
  name: string
  path: string
}

export type SessionStatus = 'running' | 'completed' | 'failed' | 'terminated' | 'waiting_input'

export type SessionPermissionMode = 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions'

export interface Session {
  id: string
  parentSessionId?: string
  title?: string
  createdAt: number
  messageCount?: number
  lastMessage?: string
  lastUserMessage?: string
  isStarred?: boolean
  isArchived?: boolean
  tags?: string[]
  status?: SessionStatus
  model?: string
  adapter?: string
  permissionMode?: SessionPermissionMode
}

export type ChatMessageContent =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string; name?: string; size?: number; mimeType?: string }
  | { type: 'tool_use'; id: string; name: string; input: any }
  | { type: 'tool_result'; tool_use_id: string; content: any; is_error?: boolean }

export interface ChatMessage {
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

export type InteractionOption = z.infer<typeof InteractionOptionSchema>
export type AskUserQuestionParams = z.infer<typeof AskUserQuestionParamsSchema>

export interface TaskDetail {
  ctxId: string
  sessionId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped'
  pid?: number
  startTime: number
  endTime?: number
  description?: string
  adapter?: string
  adapterType?: string
  model?: string
  exitCode?: number
}
