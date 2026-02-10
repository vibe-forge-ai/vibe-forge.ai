import React from 'react'

import type { ChatMessageContent } from '@vibe-forge/core'

import { DefaultTool } from './tools/DefaultTool'
import { BashTool, adapterClaudeToolRenders } from './tools/adapter-claude'
import { taskToolRenders } from './tools/task'

const TOOL_RENDERERS: Record<
  string,
  React.ComponentType<{
    item: Extract<ChatMessageContent, { type: 'tool_use' }>
    resultItem?: Extract<ChatMessageContent, { type: 'tool_result' }>
  }>
> = {
  ...taskToolRenders,
  ...adapterClaudeToolRenders
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
