import { getDb } from '#~/db/index.js'

import type { ChannelMiddleware } from './@types'

export const resolveSessionMiddleware: ChannelMiddleware = async (ctx, next) => {
  const result = getDb().getChannelSession(ctx.inbound.channelType, ctx.inbound.sessionType, ctx.inbound.channelId)
  ctx.sessionId = result?.sessionId
  await next()
}
