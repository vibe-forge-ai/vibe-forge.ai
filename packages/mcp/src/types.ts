export type {
  McpManagedTaskInput,
  McpResolvedTaskQueryOptions,
  McpSelectionFilter,
  McpTaskBindings,
  McpTaskDefinitionType,
  McpTaskHookInputs,
  McpTaskOutputEvent,
  McpTaskQueryOptions,
  McpTaskRunOptions,
  McpTaskSession
} from '@vibe-forge/types'

export interface McpOptions {
  includeTools?: string
  excludeTools?: string
  includePrompts?: string
  excludePrompts?: string
  includeResources?: string
  excludeResources?: string
  includeCategory?: string
  excludeCategory?: string
}
