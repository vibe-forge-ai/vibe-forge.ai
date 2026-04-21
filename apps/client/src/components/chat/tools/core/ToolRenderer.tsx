import React from 'react'

import type { ChatMessageContent } from '@vibe-forge/core'

import { DefaultTool } from '../DefaultTool'
import { GenericClaudeTool, adapterClaudeToolRenders, isClaudeToolName } from '../adapter-claude'
import { MdpTool, mdpToolRenders } from '../plugin-mdp'
import { chromeDevtoolsToolRenders } from '../plugin-chrome-devtools'
import { taskToolRenders } from '../task'
import { isMdpToolName } from '../plugin-mdp/mdp-tool-utils'

const TOOL_RENDERERS: Record<
  string,
  React.ComponentType<{
    item: Extract<ChatMessageContent, { type: 'tool_use' }>
    resultItem?: Extract<ChatMessageContent, { type: 'tool_result' }>
  }>
> = {
  ...taskToolRenders,
  ...adapterClaudeToolRenders,
  ...mdpToolRenders,
  ...chromeDevtoolsToolRenders
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
  const Renderer = foundRenderer ?? (isClaudeToolName(toolName)
    ? GenericClaudeTool
    : isMdpToolName(toolName)
    ? MdpTool
    : DefaultTool)
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
