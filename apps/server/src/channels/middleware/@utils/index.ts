import type { ChatMessageContent } from '@vibe-forge/core'
import type { ChannelInboundEvent } from '@vibe-forge/core/channel'

export const stripSpeakerPrefix = (text: string) => {
  const lines = text.split('\n')
  if (lines.length < 2) return text
  if (/^\[[^\]]+\]\s*:\s*$/.test(lines[0]?.trim() ?? '')) {
    return lines.slice(1).join('\n')
  }
  return text
}

export const stripLeadingAtTags = (text: string) => {
  let result = text
  while (true) {
    const trimmed = result.trimStart()
    if (!trimmed.startsWith('<at ')) return result
    const endIndex = trimmed.indexOf('</at>')
    if (endIndex < 0) return result
    result = trimmed.slice(endIndex + '</at>'.length)
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value != null
}

const isChatMessageContent = (value: unknown): value is ChatMessageContent => {
  if (!isRecord(value)) return false
  const type = value.type
  if (type === 'text') {
    return typeof value.text === 'string'
  }
  if (type === 'image') {
    return typeof value.url === 'string' &&
      (value.name == null || typeof value.name === 'string') &&
      (value.size == null || typeof value.size === 'number') &&
      (value.mimeType == null || typeof value.mimeType === 'string')
  }
  if (type === 'tool_use') {
    return typeof value.id === 'string' && typeof value.name === 'string'
  }
  if (type === 'tool_result') {
    return typeof value.tool_use_id === 'string' &&
      (value.is_error == null || typeof value.is_error === 'boolean')
  }
  return false
}

export const getInboundContentItems = (inbound: ChannelInboundEvent): ChatMessageContent[] | undefined => {
  const raw = inbound.raw
  if (!isRecord(raw)) return undefined
  const maybe = raw.contentItems
  if (!Array.isArray(maybe)) return undefined
  const items: ChatMessageContent[] = []
  for (const item of maybe) {
    if (!isChatMessageContent(item)) return undefined
    items.push(item)
  }
  return items
}
