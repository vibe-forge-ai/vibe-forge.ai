import { Client, Domain, EventDispatcher, WSClient } from '@larksuiteoapi/node-sdk'

import type { ChannelConnection, ChannelFollowUp, ChannelInboundEvent, ChannelLogger } from '@vibe-forge/core/channel'
import { defineCreateChannelConnection } from '@vibe-forge/core/channel'

import type { LarkChannelConfig, LarkChannelMessage, LarkMessagePayload } from '#~/types.js'
import type { LarkPushFollowUpsResponse, LarkSendMessageResponse } from '#~/types.js'

import { parseLarkContent } from './utils/parse'
import { createTenantTokenProvider } from './utils/tenant-token'
import { resolveLarkId } from './utils/text-format'

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
  }) as LarkSendMessageResponse
  if (result.code != null && result.code !== 0) {
    throw new Error(`Lark message send failed: ${result.msg ?? 'unknown error'}`)
  }

  return {
    messageId: result.data?.message_id
  }
}

const pushLarkFollowUps = async (
  messageId: string,
  followUps: readonly ChannelFollowUp[],
  tenantTokenProvider: () => Promise<string | undefined>
) => {
  const accessToken = await tenantTokenProvider()
  if (!accessToken) {
    throw new Error('Lark push follow up failed: missing tenant access token')
  }

  const response = await globalThis.fetch(
    `https://fsopen.bytedance.net/open-apis/im/v1/messages/${encodeURIComponent(messageId)}/push_follow_up`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify({
        follow_ups: followUps.map(followUp => ({
          content: followUp.content,
          i18n_contents: followUp.i18nContents?.map(item => ({
            content: item.content,
            language: item.language
          }))
        }))
      })
    }
  )

  if (!response.ok) {
    throw new Error(`Lark push follow up failed: HTTP ${response.status ?? 0}`)
  }

  const result = await response.json().catch(() => undefined) as LarkPushFollowUpsResponse | undefined
  if (result?.code != null && result.code !== 0) {
    throw new Error(`Lark push follow up failed: ${result.msg ?? 'unknown error'}`)
  }
}

const reactionPool = [
  'STRIVE',
  'MeMeMe',
  'Typing',
  'OnIt',
  'OneSecond',
  'SHAKE',
  'HIGHFIVE',
  'SaluteFace'
]

const toStandardSessionType = (chatType: string) => {
  if (chatType === 'p2p') return 'direct'
  return 'group'
}

const toChannelInboundEvent = async (
  payload: LarkMessagePayload,
  client: Client,
  options?: {
    tenantTokenProvider?: () => Promise<string | undefined>
  }
): Promise<ChannelInboundEvent | null> => {
  const message = payload.message
  if (message == null || message.chat_id == null || message.chat_type == null) {
    return null
  }
  const senderId = resolveLarkId(payload.sender?.sender_id)
  let reactionId: string | undefined
  let acked = false
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

  const parsed = await parseLarkContent({
    content: message.content,
    mentions: message.mentions,
    client,
    tenantTokenProvider: options?.tenantTokenProvider
  })
  const rawText = parsed.rawText
  const formattedText = parsed.formattedText
  const displayText = senderId ? `[${senderId}]:\n${formattedText ?? ''}` : formattedText

  return {
    channelType: 'lark',
    sessionType: toStandardSessionType(message.chat_type),
    channelId: message.chat_id,
    senderId,
    messageId: message.message_id,
    text: displayText,
    replyTo: {
      receiveId: message.chat_id,
      receiveIdType: 'chat_id'
    },
    ack,
    unack,
    raw: {
      payload,
      rawText,
      formattedText,
      contentItems: parsed.contentItems,
      images: parsed.images,
      rich: parsed.rich
    }
  }
}

export const createChannelConnection = defineCreateChannelConnection(async (
  config: LarkChannelConfig,
  options?: {
    logger?: ChannelLogger
  }
): Promise<ChannelConnection<LarkChannelMessage>> => {
  const logger = options?.logger
  const domain = {
    Feishu: Domain.Feishu,
    Lark: Domain.Lark
  }[config.domain ?? 'Feishu']
  const commonClientOptions = {
    appId: config.appId,
    appSecret: config.appSecret,
    domain,
    logger
  }
  const client = new Client({
    ...commonClientOptions
  })
  const wsClient = new WSClient({
    ...commonClientOptions
  })
  const tenantTokenProvider = createTenantTokenProvider(config)
  return {
    sendMessage: async (message) => {
      return sendLarkMessage(client, message)
    },
    pushFollowUps: async ({ messageId, followUps }) => {
      await pushLarkFollowUps(messageId, followUps, tenantTokenProvider)
    },
    startReceiving: async ({ handlers }) => {
      const dispatcher = new EventDispatcher({})
      dispatcher.register({
        'im.message.receive_v1': async (payload: unknown) => {
          const inbound = await toChannelInboundEvent(payload as LarkMessagePayload, client, {
            tenantTokenProvider
          })
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
