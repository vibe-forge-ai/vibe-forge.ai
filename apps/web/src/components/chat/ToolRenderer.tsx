import type { ChatMessageContent } from '@vibe-forge/core'
import React from 'react'
import { BashTool } from './tools/BashTool'
import { DefaultTool } from './tools/DefaultTool'
import { GlobTool } from './tools/GlobTool'
import { GrepTool } from './tools/GrepTool'
import { GetTaskInfoTool, StartTasksTool } from './tools/task'
import { LsTool } from './tools/LSTool'
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
  Bash: BashTool,
  LS: LsTool,
  Glob: GlobTool,
  Grep: GrepTool,
  Read: ReadTool,
  Write: WriteTool,
  StartTasks: StartTasksTool,
  mcp__VibeForge__StartTasks: StartTasksTool,
  GetTaskInfo: GetTaskInfoTool,
  mcp__VibeForge__GetTaskInfo: GetTaskInfoTool,
  TodoWrite: TodoTool
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
      'command' in input &&
      (('description' in input && input.description != null) || ('reason' in input && input.reason != null))
    ) {
      return BashTool
    }
  }
  return null
}
