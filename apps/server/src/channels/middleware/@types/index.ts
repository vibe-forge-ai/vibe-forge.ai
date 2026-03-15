import type { ChatMessageContent } from '@vibe-forge/core'
import type { ChannelBaseConfig, ChannelConnection, ChannelInboundEvent } from '@vibe-forge/core/channel'

export interface ChannelTextMessage {
  receiveId: string
  receiveIdType: string
  text: string
}

export interface ChannelContext {
  channelKey: string
  inbound: ChannelInboundEvent
  connection: ChannelConnection<ChannelTextMessage> | undefined
  config: ChannelBaseConfig | undefined
  /** Resolved from DB before running the middleware chain */
  sessionId: string | undefined
  /** Parsed rich content items from inbound.raw, if any */
  contentItems: ChatMessageContent[] | undefined
  /** Normalized text stripped of @-tags and speaker prefixes, used for command matching */
  commandText: string
  /** Send a text reply back to the channel; no-op when connection is unavailable */
  reply: (text: string) => Promise<void>
}

export type ChannelMiddleware = (ctx: ChannelContext, next: () => Promise<void>) => Promise<void>
