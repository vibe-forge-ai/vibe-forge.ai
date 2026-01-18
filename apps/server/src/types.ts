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

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
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
