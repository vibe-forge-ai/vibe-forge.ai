import type { ChatMessageContent } from '@vibe-forge/core'

import type { CliInputControlEvent, RunInputFormat } from './types'

export const supportsPrintInteractionResponses = (format: RunInputFormat | undefined) => format === 'stream-json'

const isChatTextContent = (value: unknown): value is Extract<ChatMessageContent, { type: 'text' }> => (
  value != null &&
  typeof value === 'object' &&
  (value as { type?: unknown }).type === 'text' &&
  typeof (value as { text?: unknown }).text === 'string'
)

const isChatImageContent = (value: unknown): value is Extract<ChatMessageContent, { type: 'image' }> => (
  value != null &&
  typeof value === 'object' &&
  (value as { type?: unknown }).type === 'image' &&
  typeof (value as { url?: unknown }).url === 'string'
)

const normalizeChatInputContent = (value: unknown): string | ChatMessageContent[] => {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    const items = value.filter((item): item is ChatMessageContent =>
      isChatTextContent(item) || isChatImageContent(item)
    )
    if (items.length > 0) {
      return items
    }
  }

  throw new Error('Unsupported message content. Use a string or an array of text/image content items.')
}

const normalizeSubmitInputData = (value: unknown): string | string[] => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed !== '') {
      return trimmed
    }
  }

  if (Array.isArray(value)) {
    const items = value
      .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
      .map(item => item.trim())
    if (items.length > 0) {
      return items
    }
  }

  throw new Error('Submit input requires a non-empty string or string array in "data" or "response".')
}

export const parseCliInputControlEvent = (value: unknown): CliInputControlEvent => {
  if (typeof value === 'string') {
    return {
      type: 'message',
      content: value
    }
  }

  if (Array.isArray(value)) {
    return {
      type: 'message',
      content: normalizeChatInputContent(value)
    }
  }

  if (value == null || typeof value !== 'object') {
    throw new Error('Invalid input payload. Expected a string, array, or object.')
  }

  const record = value as Record<string, unknown>
  const type = typeof record.type === 'string' ? record.type : 'message'
  if (type === 'interrupt') {
    return { type: 'interrupt' }
  }
  if (type === 'stop') {
    return { type: 'stop' }
  }
  if (type === 'submit_input' || type === 'interaction_response' || type === 'respond_interaction') {
    const data = record.data ?? record.response ?? record.answer ?? record.value
    return {
      type: 'submit_input',
      interactionId: typeof record.interactionId === 'string' && record.interactionId.trim() !== ''
        ? record.interactionId.trim()
        : undefined,
      data: normalizeSubmitInputData(data)
    }
  }
  if (type === 'message' || type === 'user_message') {
    const content = record.content ?? record.text ?? record.message
    if (content == null) {
      throw new Error('Message input requires "content" or "text".')
    }
    return {
      type: 'message',
      content: normalizeChatInputContent(content)
    }
  }

  throw new Error(`Unsupported input event type: ${type}`)
}
