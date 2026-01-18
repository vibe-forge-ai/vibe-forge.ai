export interface AdapterOptions {
  env: Record<string, string>
  cwd: string
  sessionId: string
  type: 'create' | 'resume'
  model?: string
  systemPrompt?: string
  appendSystemPrompt?: boolean
  onEvent: (event: AdapterOutputEvent) => void
}

export type AdapterMessageContent =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: any }
  | { type: 'tool_result'; tool_use_id: string; content: any; is_error?: boolean }

export type AdapterOutputEvent =
  | { type: 'init'; data: any }
  | { type: 'message'; data: any } // data is expected to be ChatMessage or similar structure for client
  | { type: 'exit'; data: { exitCode: number | null; stderr?: string } }
  | { type: 'summary'; data: { summary: string; leafUuid: string } }
  | { type: 'raw'; data: any }

export type AdapterEvent =
  | { type: 'message'; content: AdapterMessageContent[]; parentUuid?: string }
  | { type: 'interrupt' }
  | { type: 'stop' }

export interface AdapterSession {
  kill: () => void
  emit: (event: AdapterEvent) => void
}

export interface Adapter {
  query: (options: AdapterOptions) => AdapterSession
}

export function defineAdapter(fn: (options: AdapterOptions) => AdapterSession): Adapter {
  return {
    query: fn
  }
}
