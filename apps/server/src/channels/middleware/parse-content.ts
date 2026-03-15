import type { ChannelMiddleware } from './@types'
import { getInboundContentItems, stripLeadingAtTags, stripSpeakerPrefix } from './@utils'

export const parseContentMiddleware: ChannelMiddleware = async (ctx, next) => {
  ctx.contentItems = getInboundContentItems(ctx.inbound)
  const hasContent = ctx.contentItems != null && ctx.contentItems.length > 0
  if ((ctx.inbound.text == null || ctx.inbound.text === '') && !hasContent) return
  ctx.commandText = stripLeadingAtTags(stripSpeakerPrefix(ctx.inbound.text ?? '')).trim()
  await next()
}
