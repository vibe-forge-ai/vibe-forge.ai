import type { ChatMessageContent, WSEvent } from '@vibe-forge/core'
import type { ChannelConnection, ChannelInboundEvent } from '@vibe-forge/core/channel'

import { getDb } from '#~/db/index.js'
import { createSessionWithInitialMessage } from '#~/services/sessionCreate.js'
import { extractTextFromMessage } from '#~/services/sessionEvents.js'
import { processUserMessage } from '#~/websocket/session.js'

import { handleChannelCommand } from './commands'
import { consumePendingUnack, isDuplicateMessage, resolveBinding, setBinding, setPendingUnack } from './state'
import type { ChannelRuntimeState, ChannelTextMessage } from './types'

const buildChannelTags = (inbound: ChannelInboundEvent) => {
  if (inbound.sessionType === 'direct' && inbound.senderId) {
    return [`channel:${inbound.channelType}:direct:${inbound.senderId}`]
  }
  if (inbound.sessionType === 'group') {
    return [`channel:${inbound.channelType}:group:${inbound.channelId}`]
  }
  return []
}

const stripSpeakerPrefix = (text: string) => {
  const lines = text.split('\n')
  if (lines.length < 2) return text
  if (/^\[[^\]]+\]\s*:\s*$/.test(lines[0]?.trim() ?? '')) {
    return lines.slice(1).join('\n')
  }
  return text
}

const stripLeadingAtTags = (text: string) => {
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

const getInboundContentItems = (inbound: ChannelInboundEvent): ChatMessageContent[] | undefined => {
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

export const handleInboundEvent = async (
  channelKey: string,
  inbound: ChannelInboundEvent,
  connection: ChannelConnection<ChannelTextMessage> | undefined
) => {
  if (inbound.messageId) {
    const dedupeKey = `${inbound.channelType}:${inbound.sessionType}:${inbound.channelId}:${inbound.messageId}`
    if (isDuplicateMessage(dedupeKey)) {
      return
    }
  }
  const inboundContentItems = getInboundContentItems(inbound)
  const hasInboundContentItems = inboundContentItems != null && inboundContentItems.length > 0
  if ((inbound.text == null || inbound.text === '') && !hasInboundContentItems) return
  const db = getDb()
  let { sessionId } = db.getChannelSession(
    inbound.channelType,
    inbound.sessionType,
    inbound.channelId
  ) ?? {}

  const commandSourceText = stripLeadingAtTags(stripSpeakerPrefix(inbound.text ?? ''))
  const trimmed = commandSourceText.trim()
  const command = trimmed.split(/\s+/)[0]
  const commandResult = await handleChannelCommand(command, sessionId, inbound, connection)
  if (commandResult.handled) return

  await inbound.ack?.().catch(() => undefined)

  if (!sessionId) {
    const session = await createSessionWithInitialMessage({
      title: stripSpeakerPrefix(inbound.text ?? '').split('\n')[0],
      initialMessage: hasInboundContentItems ? undefined : inbound.text,
      initialContent: hasInboundContentItems ? inboundContentItems : undefined,
      shouldStart: true,
      tags: buildChannelTags(inbound)
    })
    sessionId = session.id
  } else {
    processUserMessage(sessionId, hasInboundContentItems ? inboundContentItems : inbound.text ?? '')
  }

  setPendingUnack(sessionId, inbound.unack)
  db.upsertChannelSession({
    channelType: inbound.channelType,
    sessionType: inbound.sessionType,
    channelId: inbound.channelId,
    channelKey,
    replyReceiveId: inbound.replyTo?.receiveId,
    replyReceiveIdType: inbound.replyTo?.receiveIdType,
    sessionId
  })
  setBinding(sessionId, {
    channelType: inbound.channelType,
    channelKey,
    channelId: inbound.channelId,
    sessionType: inbound.sessionType,
    replyReceiveId: inbound.replyTo?.receiveId,
    replyReceiveIdType: inbound.replyTo?.receiveIdType
  })
}

export const handleSessionEvent = async (
  states: Map<string, ChannelRuntimeState>,
  sessionId: string,
  event: WSEvent
) => {
  if (event.type !== 'message' || event.message.role !== 'assistant') return
  const text = extractTextFromMessage(event.message)
  if (text == null || text === '') return

  const unack = consumePendingUnack(sessionId)
  if (unack) {
    await unack().catch(() => undefined)
  }

  const binding = resolveBinding(sessionId)
  if (!binding) return
  const state = states.get(binding.channelKey)
  if (!state?.connection) return
  const receiveId = binding.replyReceiveId ?? binding.channelId
  const receiveIdType = binding.replyReceiveIdType ?? 'chat_id'
  await state.connection.sendMessage({ receiveId, receiveIdType, text })
}
