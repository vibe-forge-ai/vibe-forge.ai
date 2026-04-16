import React from 'react'

import type { ChatMessageContent } from '@vibe-forge/core'
import type { ToolViewEnvelope } from '@vibe-forge/types'

import { DefaultTool } from '../DefaultTool'
import { GenericClaudeTool, adapterClaudeToolRenders, isClaudeToolName } from '../adapter-claude'
import { chromeDevtoolsToolRenders } from '../plugin-chrome-devtools'
import { taskToolRenders } from '../task'
import { ToolViewRenderer } from './ToolViewRenderer'

const TOOL_RENDERERS: Record<
  string,
  React.ComponentType<{
    item: Extract<ChatMessageContent, { type: 'tool_use' }>
    resultItem?: Extract<ChatMessageContent, { type: 'tool_result' }>
  }>
> = {
  ...taskToolRenders,
  ...adapterClaudeToolRenders,
  ...chromeDevtoolsToolRenders
}

export function ToolRenderer({
  item,
  resultItem,
  toolView
}: {
  item: Extract<ChatMessageContent, { type: 'tool_use' }>
  resultItem?: Extract<ChatMessageContent, { type: 'tool_result' }>
  toolView?: ToolViewEnvelope
}) {
  if (toolView != null) {
    return <ToolViewRenderer toolView={toolView} />
  }

  const toolName = item.name
  const foundRenderer = TOOL_RENDERERS[toolName] ?? ToolRenderer.findRendererByInput(item)
  const Renderer = foundRenderer ?? (isClaudeToolName(toolName) ? GenericClaudeTool : DefaultTool)
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
      return GenericClaudeTool
    }
  }
  return null
}
