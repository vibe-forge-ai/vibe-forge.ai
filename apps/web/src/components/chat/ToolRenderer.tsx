import React from 'react'
import { DefaultTool } from './tools/DefaultTool'
import { BashTool } from './tools/BashTool'
import { ReadTool } from './tools/ReadTool'
import { WriteTool } from './tools/WriteTool'
import { TodoTool } from './tools/TodoTool'
import type { ChatMessageContent } from '#~/types'

const TOOL_RENDERERS: Record<string, React.ComponentType<{
  item: Extract<ChatMessageContent, { type: 'tool_use' }>,
  resultItem?: Extract<ChatMessageContent, { type: 'tool_result' }>
}>> = {
  bash: BashTool,
  Bash: BashTool, // Support capitalized 'Bash'
  execute_command: BashTool,
  Read: ReadTool,
  read_file: ReadTool,
  Write: WriteTool,
  write_file: WriteTool,
  TodoWrite: TodoTool,
  todo_write: TodoTool,
}

export function ToolRenderer({ 
  item, 
  resultItem 
}: { 
  item: Extract<ChatMessageContent, { type: 'tool_use' }>,
  resultItem?: Extract<ChatMessageContent, { type: 'tool_result' }>
}) {
  const toolName = item.name
  const Renderer = TOOL_RENDERERS[toolName] || ToolRenderer.findRendererByInput(item) || DefaultTool
  return <Renderer item={item} resultItem={resultItem} />
}

ToolRenderer.findRendererByInput = (item: Extract<ChatMessageContent, { type: 'tool_use' }>) => {
  // If input has 'command' and 'description', it's likely a bash tool even if name is different
  if (item.input && typeof item.input === 'object') {
    if ('command' in item.input && ('description' in item.input || 'reason' in item.input)) {
      return BashTool
    }
  }
  return null
}
