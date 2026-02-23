import type { ChatMessageContent } from '@vibe-forge/core'
import type React from 'react'

export interface ToolRenderProps {
  item: Extract<ChatMessageContent, { type: 'tool_use' }>
  resultItem?: Extract<ChatMessageContent, { type: 'tool_result' }>
}

export type ToolRenderComponent = React.ComponentType<ToolRenderProps>

export function defineToolRender<T extends ToolRenderComponent>(render: T) {
  return render
}

export function defineToolRenders(
  renders: Record<string, ToolRenderComponent>,
  options?: { namespace?: string }
) {
  const namespace = options?.namespace
  const entries = Object.entries(renders).flatMap(([name, renderer]) => {
    const current: Array<[string, ToolRenderComponent]> = [[name, renderer]]
    if (namespace) {
      current.push([`${namespace}${name}`, renderer])
    }
    return current
  })
  return Object.fromEntries(entries) as Record<string, ToolRenderComponent>
}
