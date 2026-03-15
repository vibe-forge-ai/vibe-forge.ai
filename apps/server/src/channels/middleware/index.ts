import type { ChannelBaseConfig, ChannelConnection, ChannelInboundEvent } from '@vibe-forge/core/channel'

import { compose } from '#~/utils/compose.js'

import type { ChannelContext, ChannelTextMessage } from './@types'
import { accessControlMiddleware } from './access-control'
import { ackMiddleware } from './ack'
import { adminGateMiddleware } from './admin-gate'
import { bindSessionMiddleware } from './bind-session'
import { channelCommandMiddleware } from './commands'
import { deduplicateMiddleware } from './deduplicate'
import { dispatchMiddleware } from './dispatch'
import { parseContentMiddleware } from './parse-content'
import { resolveSessionMiddleware } from './resolve-session'

const pipeline = compose<ChannelContext>(
  deduplicateMiddleware,
  parseContentMiddleware,
  accessControlMiddleware,
  resolveSessionMiddleware,
  channelCommandMiddleware,
  ackMiddleware,
  adminGateMiddleware,
  dispatchMiddleware,
  bindSessionMiddleware
)

export const handleInboundEvent = async (
  channelKey: string,
  inbound: ChannelInboundEvent,
  connection: ChannelConnection<ChannelTextMessage> | undefined,
  config?: ChannelBaseConfig
) => {
  await pipeline({
    channelKey,
    inbound,
    connection,
    config,
    sessionId: undefined,
    contentItems: undefined,
    commandText: '',
    reply: async (text: string) => {
      if (!connection) return
      const receiveId = inbound.replyTo?.receiveId ?? inbound.channelId
      const receiveIdType = inbound.replyTo?.receiveIdType ?? 'chat_id'
      await connection.sendMessage({ receiveId, receiveIdType, text })
    }
  })
}
