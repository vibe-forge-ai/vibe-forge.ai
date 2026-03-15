import type { ChannelMiddleware } from './@types'

export const ackMiddleware: ChannelMiddleware = async (ctx, next) => {
  await ctx.inbound.ack?.().catch(() => undefined)
  await next()
}
