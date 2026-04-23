import type { WSEvent } from '@vibe-forge/core'
import type { ToolViewEnvelope } from '@vibe-forge/types'

export type ToolViewCache = Record<string, ToolViewEnvelope>

export const mergeToolViews = (
  current: ToolViewCache,
  next: ToolViewCache
): ToolViewCache => {
  const merged = { ...current }

  for (const [toolViewId, view] of Object.entries(next)) {
    const existing = merged[toolViewId]
    if (existing == null || view.revision >= existing.revision) {
      merged[toolViewId] = view
    }
  }

  return merged
}

export const applyToolViewEvent = (
  current: ToolViewCache,
  event: WSEvent
) => {
  if (event.type !== 'tool_view') {
    return current
  }

  return mergeToolViews(current, {
    [event.view.toolViewId]: event.view
  })
}
