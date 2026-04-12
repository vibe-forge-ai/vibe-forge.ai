import { getDb } from '#~/db/index.js'

import { setBinding } from '../state'
import type { ChannelMiddleware } from './@types'

export const resolveSessionMiddleware: ChannelMiddleware = async (ctx, next) => {
  const db = getDb()
  const result = db.getChannelSession(ctx.inbound.channelType, ctx.inbound.sessionType, ctx.inbound.channelId)
  const preference = db.getChannelPreference(ctx.inbound.channelType, ctx.inbound.sessionType, ctx.inbound.channelId)
  ctx.sessionId = result?.sessionId
  ctx.channelAdapter = preference?.adapter
  ctx.channelPermissionMode = preference?.permissionMode
  ctx.channelEffort = preference?.effort
  if (result?.sessionId) {
    setBinding(result.sessionId, {
      channelType: result.channelType,
      channelKey: result.channelKey,
      channelId: result.channelId,
      sessionType: result.sessionType,
      replyReceiveId: result.replyReceiveId,
      replyReceiveIdType: result.replyReceiveIdType
    })
  }
  await next()
}
