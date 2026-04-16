import type { ChatMessage, ChatMessageContent, WSEvent } from '@vibe-forge/core'
import type { ToolViewEnvelope } from '@vibe-forge/types'

import { buildToolViewEnvelope } from './tool-view-registry.js'

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const isAssistantMessageEvent = (event: WSEvent): event is Extract<WSEvent, { type: 'message' }> => (
  event.type === 'message' &&
  event.message.role === 'assistant' &&
  Array.isArray(event.message.content)
)

const isToolUseContent = (item: unknown): item is Extract<ChatMessageContent, { type: 'tool_use' }> => (
  isRecord(item) &&
  item.type === 'tool_use' &&
  typeof item.id === 'string' &&
  typeof item.name === 'string'
)

const isToolResultContent = (
  item: unknown
): item is Extract<ChatMessageContent, { type: 'tool_result' }> => (
  isRecord(item) &&
  item.type === 'tool_result' &&
  typeof item.tool_use_id === 'string'
)

const collectAffectedToolUseIdsFromMessage = (message: ChatMessage) => {
  if (!Array.isArray(message.content)) {
    return new Set<string>()
  }

  return message.content.reduce((set, item) => {
    if (isToolUseContent(item)) {
      set.add(item.id)
    } else if (isToolResultContent(item)) {
      set.add(item.tool_use_id)
    }
    return set
  }, new Set<string>())
}

export const collectAffectedToolUseIdsFromEvent = (event: WSEvent) => {
  return event.type === 'message'
    ? collectAffectedToolUseIdsFromMessage(event.message)
    : new Set<string>()
}

export const buildSessionToolViews = (
  events: WSEvent[],
  options: {
    adapterInstanceId?: string
  } = {}
) => {
  const toolViews: Record<string, ToolViewEnvelope> = {}
  const latestInputs = new Map<string, {
    sourceMessageId: string
    toolUse: Extract<ChatMessageContent, { type: 'tool_use' }>
  }>()

  for (const event of events) {
    if (!isAssistantMessageEvent(event)) {
      continue
    }

    for (const item of event.message.content) {
      if (isToolUseContent(item)) {
        latestInputs.set(item.id, {
          sourceMessageId: event.message.id,
          toolUse: item
        })

        const view = buildToolViewEnvelope({
          sourceMessageId: event.message.id,
          toolUse: item
        }, options)
        if (view != null) {
          toolViews[view.toolViewId] = view
        }
        continue
      }

      if (!isToolResultContent(item)) {
        continue
      }

      const toolUse = latestInputs.get(item.tool_use_id)
      if (toolUse == null) {
        continue
      }

      const view = buildToolViewEnvelope({
        sourceMessageId: toolUse.sourceMessageId,
        toolUse: toolUse.toolUse,
        toolResult: item
      }, options)
      if (view != null) {
        toolViews[view.toolViewId] = view
      }
    }
  }

  return toolViews
}
