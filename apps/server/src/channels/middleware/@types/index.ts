import type { ChatMessageContent, ConfigSource, Session } from '@vibe-forge/core'
import type {
  ChannelBaseConfig,
  ChannelConnection,
  ChannelFollowUp,
  ChannelInboundEvent,
  ChannelSendResult
} from '@vibe-forge/core/channel'

import type { LanguageCode, MessageArgs, MessageCatalog } from '../i18n'

export interface ChannelTextMessage {
  receiveId: string
  receiveIdType: string
  text: string
}

export interface ChannelContext {
  channelKey: string
  configSource?: ConfigSource
  inbound: ChannelInboundEvent
  connection: ChannelConnection<ChannelTextMessage> | undefined
  config: ChannelBaseConfig | undefined
  /** Resolved from DB before running the middleware chain */
  sessionId: string | undefined
  /** Parsed rich content items from inbound.raw, if any */
  contentItems: ChatMessageContent[] | undefined
  /** Normalized text stripped of @-tags and speaker prefixes, used for command matching */
  commandText: string
  /** Register i18n messages into the shared middleware catalog */
  defineMessages: (lang: LanguageCode, messages: MessageCatalog) => void
  /** Translate an i18n key using the channel's configured language */
  t: (key: string, args?: MessageArgs) => string
  /** Send a text reply back to the channel; no-op when connection is unavailable */
  reply: (text: string) => Promise<ChannelSendResult | undefined>
  /** Attach follow-up bubbles below a sent message when the channel supports it */
  pushFollowUps: (input: { messageId?: string; followUps: readonly ChannelFollowUp[] }) => Promise<void>

  // ── session operations ──
  /** Get the session bound to the current channel, or undefined */
  getBoundSession: () => Session | undefined
  /** Unbind the current session (delete DB record and binding) */
  resetSession: () => void
  /** Stop the running session (kill the process) */
  stopSession: () => void
  /** Restart the current session (kill + start) */
  restartSession: () => Promise<void>
  /** Update session fields in DB */
  updateSession: (updates: Partial<Pick<Session, 'model' | 'adapter' | 'permissionMode'>>) => void
}

export type ChannelMiddleware = (ctx: ChannelContext, next: () => Promise<void>) => Promise<void>
