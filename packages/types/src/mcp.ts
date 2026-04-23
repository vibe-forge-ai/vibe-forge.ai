import type { ChatMessage } from './message'
import type { SessionPermissionMode } from './session'

export type McpTaskDefinitionType = 'default' | 'spec' | 'entity' | 'workspace'

export interface McpSelectionFilter {
  include?: string[]
  exclude?: string[]
}

export interface McpManagedTaskInput {
  description: string
  type?: McpTaskDefinitionType
  name?: string
  adapter?: string
  model?: string
  permissionMode?: SessionPermissionMode
  background?: boolean
}

export interface McpResolvedTaskQueryOptions {
  systemPrompt?: string
  tools?: McpSelectionFilter
  skills?: McpSelectionFilter
  mcpServers?: McpSelectionFilter
  promptAssetIds?: string[]
}

export type McpTaskOutputEvent =
  | { type: 'init'; data: unknown }
  | { type: 'summary'; data: unknown }
  | { type: 'message'; data: ChatMessage }
  | { type: 'error'; data: { message: string; fatal?: boolean } }
  | { type: 'exit'; data: { exitCode?: number; stderr?: string } }
  | { type: 'stop'; data?: ChatMessage }

type McpTaskEmitEvent =
  | { type: 'message'; content: Array<{ type: 'text'; text: string }>; parentUuid?: string }
  | { type: 'interrupt' }
  | { type: 'stop' }

export interface McpTaskSession {
  kill(): void
  emit(event: McpTaskEmitEvent): void
  pid?: number
}

export interface McpTaskRunOptions {
  adapter?: string
  cwd: string
  env: Record<string, string | null | undefined>
}

export interface McpTaskQueryOptions {
  type: 'create' | 'resume'
  runtime: 'mcp'
  mode?: 'stream' | 'direct'
  sessionId: string
  model?: string
  systemPrompt?: string
  permissionMode?: SessionPermissionMode
  tools?: McpSelectionFilter
  skills?: McpSelectionFilter
  mcpServers?: McpSelectionFilter
  promptAssetIds?: string[]
  onEvent: (event: McpTaskOutputEvent) => void
}

export interface McpTaskHookInputs {
  StartTasks: {
    cwd: string
    sessionId: string
    tasks: McpManagedTaskInput[]
  }
  GenerateSystemPrompt: {
    cwd: string
    sessionId: string
    type?: Extract<McpTaskDefinitionType, 'spec' | 'entity' | 'workspace'>
    name?: string
    data: unknown
  }
}

export interface McpTaskBindings {
  createTaskId(): string
  callHook<K extends keyof McpTaskHookInputs>(
    hookEventName: K,
    input: McpTaskHookInputs[K],
    env?: Record<string, unknown>
  ): Promise<unknown>
  generateAdapterQueryOptions(
    type: Extract<McpTaskDefinitionType, 'spec' | 'entity' | 'workspace'> | undefined,
    name?: string,
    cwd?: string
  ): Promise<readonly [unknown, McpResolvedTaskQueryOptions]>
  run(
    options: McpTaskRunOptions,
    adapterOptions: McpTaskQueryOptions
  ): Promise<{
    session: McpTaskSession
  }>
  loadInjectDefaultSystemPromptValue(cwd: string, cliValue?: boolean): Promise<boolean | undefined>
  mergeSystemPrompts(options: {
    generatedSystemPrompt?: string
    userSystemPrompt?: string
    injectDefaultSystemPrompt?: boolean
  }): string | undefined
  extractTextFromMessage(message: ChatMessage): string
}
