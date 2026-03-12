import { Client, Domain, EventDispatcher, WSClient } from '@larksuiteoapi/node-sdk'

import type { ChannelConnection, ChannelEventHandlers, ChannelInboundEvent } from '@vibe-forge/core/channel'
import { defineChannelConnection } from '@vibe-forge/core/channel'

import type { LarkChannelConfig, LarkChannelMessage } from './index'
import { larkChannelConfigSchema } from './index'

const sendLarkMessage = async (
  client: Client,
  message: LarkChannelMessage
) => {
  const result = await client.im.message.create({
    params: {
      receive_id_type: message.receiveIdType
    },
    data: {
      receive_id: message.receiveId,
      msg_type: 'text',
      content: JSON.stringify({ text: message.text })
    }
  })
  if (result.code != null && result.code !== 0) {
    throw new Error(`Lark message send failed: ${result.msg ?? 'unknown error'}`)
  }
}

interface LarkMessagePayload {
  event_type?: string
  message?: {
    chat_id?: string
    chat_type?: string
    content?: string
    message_id?: string
  }
  sender?: {
    sender_id?: {
      open_id?: string | null
      user_id?: string | null
      union_id?: string | null
    }
  }
}

const parseLarkText = (content?: string) => {
  if (content == null || content === '') return undefined
  try {
    const parsed = JSON.parse(content) as { text?: string }
    return parsed.text ?? undefined
  } catch {
    return undefined
  }
}

export const toChannelInboundEvent = (payload: LarkMessagePayload, client: Client): ChannelInboundEvent | null => {
  const message = payload.message
  if (message == null || message.chat_id == null || message.chat_type == null) {
    return null
  }
  const senderId = payload.sender?.sender_id?.open_id ??
    payload.sender?.sender_id?.user_id ??
    payload.sender?.sender_id?.union_id ??
    undefined
  let reactionId: string | undefined
  let acked = false
  const reactionPool = ['STRIVE', 'MeMeMe', 'Typing', 'OnIt', 'OneSecond', 'SHAKE', 'HIGHFIVE', 'SaluteFace']
  const emojiType = reactionPool[Math.floor(Math.random() * reactionPool.length)]
  const ack = async () => {
    if (acked) return
    if (message.message_id == null) return
    const res = await client.im.v1.messageReaction.create({
      path: {
        message_id: message.message_id
      },
      data: {
        reaction_type: {
          emoji_type: emojiType
        }
      }
    })
    if (res.code == null || res.code === 0) {
      reactionId = res.data?.reaction_id
      acked = true
    }
  }
  const unack = async () => {
    if (!acked) return
    if (message.message_id == null || reactionId == null) return
    const res = await client.im.v1.messageReaction.delete({
      path: {
        message_id: message.message_id,
        reaction_id: reactionId
      }
    })
    void res
  }

  return {
    channelType: 'lark',
    sessionType: message.chat_type,
    channelId: message.chat_id,
    senderId,
    messageId: message.message_id,
    text: parseLarkText(message.content),
    replyTo: {
      receiveId: message.chat_id,
      receiveIdType: 'chat_id'
    },
    ack,
    unack,
    raw: payload
  }
}

export const connectLarkChannel = defineChannelConnection(async (
  config: LarkChannelConfig
): Promise<ChannelConnection<LarkChannelMessage>> => {
  const client = new Client({
    appId: config.appId,
    appSecret: config.appSecret,
    domain: Domain.Feishu
  })
  const wsClient = new WSClient({
    appId: config.appId,
    appSecret: config.appSecret
  })
  return {
    sendMessage: async (message) => {
      await sendLarkMessage(client, message)
    },
    startReceiving: async ({ handlers }) => {
      const dispatcher = new EventDispatcher({})
      dispatcher.register({
        'im.message.receive_v1': async (payload: unknown) => {
          const inbound = toChannelInboundEvent(payload as LarkMessagePayload, client)
          if (inbound == null) return
          await handlers.message?.(inbound)
        }
      })
      await wsClient.start({
        eventDispatcher: dispatcher
      })
    },
    close: async () => wsClient.close()
  }
})

export const connectChannel = connectLarkChannel
export const configSchema = larkChannelConfigSchema
