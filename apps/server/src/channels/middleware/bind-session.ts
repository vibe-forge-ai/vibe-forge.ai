import type { ChannelInboundEvent } from '@vibe-forge/core/channel'

import { getDb } from '#~/db/index.js'

import { deleteBinding, setBinding, setPendingUnack } from '../state'
import type { ChannelMiddleware } from './@types'

const isSameChannel = (
  row: {
    channelType: string
    sessionType: string
    channelId: string
  },
  input: {
    channelType: string
    sessionType: string
    channelId: string
  }
) => (
  row.channelType === input.channelType &&
  row.sessionType === input.sessionType &&
  row.channelId === input.channelId
)

export const bindChannelSession = (input: {
  channelType: string
  sessionType: string
  channelId: string
  channelKey: string
  replyReceiveId?: string
  replyReceiveIdType?: string
  unack?: () => Promise<void>
  sessionId: string
}) => {
  const {
    channelType,
    sessionType,
    channelId,
    channelKey,
    replyReceiveId,
    replyReceiveIdType,
    unack,
    sessionId
  } = input
  const db = getDb()
  const previousChannelBinding = db.getChannelSession(channelType, sessionType, channelId)
  const transferredBinding = db.getChannelSessionBySessionId(sessionId)

  if (previousChannelBinding?.sessionId != null && previousChannelBinding.sessionId !== sessionId) {
    deleteBinding(previousChannelBinding.sessionId)
  }

  if (transferredBinding != null && !isSameChannel(transferredBinding, { channelType, sessionType, channelId })) {
    db.deleteChannelSession(
      transferredBinding.channelType,
      transferredBinding.sessionType,
      transferredBinding.channelId
    )
  }

  setPendingUnack(sessionId, unack)
  db.upsertChannelSession({
    channelType,
    sessionType,
    channelId,
    channelKey,
    replyReceiveId,
    replyReceiveIdType,
    sessionId
  })
  setBinding(sessionId, {
    channelType,
    channelKey,
    channelId,
    sessionType,
    replyReceiveId,
    replyReceiveIdType
  })

  return {
    alreadyBound: previousChannelBinding?.sessionId === sessionId,
    previousSessionId: previousChannelBinding?.sessionId !== sessionId
      ? previousChannelBinding?.sessionId
      : undefined,
    transferredFrom:
      transferredBinding != null && !isSameChannel(transferredBinding, { channelType, sessionType, channelId })
        ? transferredBinding
        : undefined
  }
}

export const syncChannelSessionBinding = (input: {
  channelKey: string
  inbound: ChannelInboundEvent
  sessionId: string
}) => {
  const { channelKey, inbound, sessionId } = input
  return bindChannelSession({
    channelType: inbound.channelType,
    sessionType: inbound.sessionType,
    channelId: inbound.channelId,
    channelKey,
    replyReceiveId: inbound.replyTo?.receiveId,
    replyReceiveIdType: inbound.replyTo?.receiveIdType,
    unack: inbound.unack,
    sessionId
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
