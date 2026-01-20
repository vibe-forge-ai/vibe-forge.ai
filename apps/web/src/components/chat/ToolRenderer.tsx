import type { ChatMessageContent } from '@vibe-forge/core'
import React from 'react'
import { BashTool } from './tools/BashTool'
import { DefaultTool } from './tools/DefaultTool'
import { ReadTool } from './tools/ReadTool'
import { TodoTool } from './tools/TodoTool'
import { WriteTool } from './tools/WriteTool'

const TOOL_RENDERERS: Record<
  string,
  React.ComponentType<{
    item: Extract<ChatMessageContent, { type: 'tool_use' }>
    resultItem?: Extract<ChatMessageContent, { type: 'tool_result' }>
  }>
> = {
  bash: BashTool,
  Bash: BashTool, // Support capitalized 'Bash'
  execute_command: BashTool,
  Read: ReadTool,
  read_file: ReadTool,
  Write: WriteTool,
  write_file: WriteTool,
  TodoWrite: TodoTool,
  todo_write: TodoTool
}

export function ToolRenderer({
  item,
  resultItem
}: {
  item: Extract<ChatMessageContent, { type: 'tool_use' }>
  resultItem?: Extract<ChatMessageContent, { type: 'tool_result' }>
}) {
  const toolName = item.name
  const foundRenderer = TOOL_RENDERERS[toolName] ?? ToolRenderer.findRendererByInput(item)
  const Renderer = foundRenderer ?? DefaultTool
  return <Renderer item={item} resultItem={resultItem} />
}

ToolRenderer.findRendererByInput = (item: Extract<ChatMessageContent, { type: 'tool_use' }>) => {
  // If input has 'command' and 'description', it's likely a bash tool even if name is different
  const input = item.input as Record<string, unknown> | null
  if (input != null && typeof input === 'object') {
    if (
      'command' in input
      && (('description' in input && input.description != null) || ('reason' in input && input.reason != null))
    ) {
      return BashTool
    }
  }
  return null
}
