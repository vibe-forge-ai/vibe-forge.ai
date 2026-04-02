import type { ChannelInboundEvent } from '@vibe-forge/core/channel'

import { getDb } from '#~/db/index.js'

import { setBinding, setPendingUnack } from '../state'
import type { ChannelMiddleware } from './@types'

export const syncChannelSessionBinding = (input: {
  channelKey: string
  inbound: ChannelInboundEvent
  sessionId: string
}) => {
  const { channelKey, inbound, sessionId } = input
  const db = getDb()
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

export const bindSessionMiddleware: ChannelMiddleware = async (ctx, next) => {
  const { channelKey, inbound, sessionId } = ctx
  if (!sessionId) return

  syncChannelSessionBinding({
    channelKey,
    inbound,
    sessionId
  })

  await next()
}
