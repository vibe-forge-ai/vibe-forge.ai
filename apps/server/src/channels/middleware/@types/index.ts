import type { ChatMessageContent, ConfigSource, EffortLevel, Session, SessionPermissionMode } from '@vibe-forge/core'
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
  /** Channel-level preferred adapter used when the next session is created */
  channelAdapter: string | undefined
  /** Channel-level preferred permission mode used when the next session is created */
  channelPermissionMode: SessionPermissionMode | undefined
  /** Channel-level preferred effort used when the next session is created */
  channelEffort: EffortLevel | undefined
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
  /** Archive and unbind the current session */
  resetSession: () => void
  /** Stop the running session (kill the process) */
  stopSession: () => void
  /** Restart the current session (kill + start) */
  restartSession: () => Promise<void>
  /** Update session fields in DB */
  updateSession: (updates: Partial<Pick<Session, 'model' | 'adapter' | 'permissionMode' | 'effort'>>) => void
  /** Read the adapter preference for the next session created in this channel */
  getChannelAdapterPreference: () => string | undefined
  /** Persist the adapter preference for the next session created in this channel */
  setChannelAdapterPreference: (adapter: string | undefined) => void
  /** Read the permission mode preference for the next session created in this channel */
  getChannelPermissionModePreference: () => SessionPermissionMode | undefined
  /** Persist the permission mode preference for the next session created in this channel */
  setChannelPermissionModePreference: (permissionMode: SessionPermissionMode | undefined) => void
  /** Read the effort preference for the next session created in this channel */
  getChannelEffortPreference: () => EffortLevel | undefined
  /** Persist the effort preference for the next session created in this channel */
  setChannelEffortPreference: (effort: EffortLevel | undefined) => void
}

export type ChannelMiddleware = (ctx: ChannelContext, next: () => Promise<void>) => Promise<void>
