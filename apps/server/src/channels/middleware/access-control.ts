import type { ChannelBaseConfig, ChannelInboundEvent } from '@vibe-forge/core/channel'

import type { ChannelMiddleware } from './@types'

export const checkChannelAccess = (
  inbound: ChannelInboundEvent,
  config: ChannelBaseConfig | undefined
): boolean => {
  if (!config) return true
  const access = config.access
  if (!access) return true
  const senderId = inbound.senderId

  // Admins bypass all access controls
  if (senderId && access.admins && access.admins.includes(senderId)) return true

  // Check chat type permissions (default: both allowed)
  if (inbound.sessionType === 'direct' && access.allowPrivateChat === false) return false
  if (inbound.sessionType === 'group' && access.allowGroupChat === false) return false

  // Group-level whitelist / blacklist (only applies to group messages)
  if (inbound.sessionType === 'group') {
    const channelId = inbound.channelId
    if (access.blockedGroups && access.blockedGroups.includes(channelId)) return false
    if (access.allowedGroups && access.allowedGroups.length > 0 && !access.allowedGroups.includes(channelId)) {
      return false
    }
  }

  // Sender blacklist (takes priority over whitelist)
  if (senderId && access.blockedSenders && access.blockedSenders.includes(senderId)) return false

  // Sender whitelist
  if (access.allowedSenders && access.allowedSenders.length > 0) {
    if (!senderId || !access.allowedSenders.includes(senderId)) return false
  }

  return true
}

export const accessControlMiddleware: ChannelMiddleware = async (ctx, next) => {
  if (!checkChannelAccess(ctx.inbound, ctx.config)) return
  await next()
}
