import { isDuplicateMessage } from '../state'
import type { ChannelMiddleware } from './@types'

export const deduplicateMiddleware: ChannelMiddleware = async (ctx, next) => {
  const { inbound } = ctx
  if (isDuplicateMessage(`${inbound.channelType}:${inbound.sessionType}:${inbound.channelId}:${inbound.messageId}`)) {
    return
  }
  await next()
}
