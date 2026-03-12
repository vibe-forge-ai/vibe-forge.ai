import type { ChannelConnection, ChannelInboundEvent } from '@vibe-forge/core/channel'

import { getDb } from '#~/db/index.js'

import { deleteBinding } from './state'
import type { ChannelTextMessage } from './types'

export const sendChannelMessage = async (
  connection: ChannelConnection<ChannelTextMessage> | undefined,
  inbound: ChannelInboundEvent,
  text: string
) => {
  if (!connection) return
  const receiveId = inbound.replyTo?.receiveId ?? inbound.channelId
  const receiveIdType = inbound.replyTo?.receiveIdType ?? 'chat_id'
  await connection.sendMessage({ receiveId, receiveIdType, text })
}

export const handleChannelCommand = async (
  command: string,
  sessionId: string | undefined,
  inbound: ChannelInboundEvent,
  connection: ChannelConnection<ChannelTextMessage> | undefined
) => {
  const db = getDb()
  if (command === '/help') {
    await inbound.ack?.().catch(() => undefined)
    await sendChannelMessage(connection, inbound, '支持的指令：\n- /reset：清空会话绑定\n- /help：查看指令列表')
    await inbound.unack?.().catch(() => undefined)
    return { handled: true, sessionId }
  }
  if (command === '/reset') {
    await inbound.ack?.().catch(() => undefined)
    if (sessionId) {
      db.deleteChannelSessionBySessionId(sessionId)
      deleteBinding(sessionId)
    }
    await sendChannelMessage(connection, inbound, '已重置会话，可以继续对话。')
    await inbound.unack?.().catch(() => undefined)
    return { handled: true, sessionId: undefined }
  }
  return { handled: false, sessionId }
}
