import type { WSEvent } from '@vibe-forge/core'
import type { ChannelConnection, ChannelInboundEvent } from '@vibe-forge/core/channel'

import { getDb } from '#~/db/index.js'
import { createSessionWithInitialMessage } from '#~/services/sessionCreate.js'
import { extractTextFromMessage } from '#~/services/sessionEvents.js'
import { processUserMessage } from '#~/websocket/session.js'

import { handleChannelCommand } from './commands'
import { consumePendingUnack, isDuplicateMessage, resolveBinding, setBinding, setPendingUnack } from './state'
import type { ChannelRuntimeState, ChannelTextMessage } from './types'

const buildChannelTags = (inbound: ChannelInboundEvent) => {
  if (inbound.channelType !== 'lark') return []
  if (inbound.sessionType === 'p2p' && inbound.senderId) {
    return [`channel:lark:direct:${inbound.senderId}`]
  }
  if (inbound.sessionType === 'group') {
    return [`channel:lark:group:${inbound.channelId}`]
  }
  return []
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
  if (inbound.text == null || inbound.text === '') return
  const db = getDb()
  let { sessionId } = db.getChannelSession(
    inbound.channelType,
    inbound.sessionType,
    inbound.channelId
  ) ?? {}

  const trimmed = inbound.text.trim()
  const command = trimmed.split(/\s+/)[0]
  const commandResult = await handleChannelCommand(command, sessionId, inbound, connection)
  if (commandResult.handled) return

  await inbound.ack?.().catch(() => undefined)

  if (!sessionId) {
    const session = await createSessionWithInitialMessage({
      title: inbound.text.split('\n')[0],
      initialMessage: inbound.text,
      shouldStart: true,
      tags: buildChannelTags(inbound)
    })
    sessionId = session.id
  } else {
    processUserMessage(sessionId, inbound.text)
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
