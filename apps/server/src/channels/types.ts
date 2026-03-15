import type { WSEvent } from '@vibe-forge/core'
import type { ChannelBaseConfig, ChannelConnection, ChannelConnectionOptions } from '@vibe-forge/core/channel'

import type { ChannelTextMessage } from './middleware/@types'

export interface ChannelRuntimeState {
  key: string
  type: string
  status: 'connected' | 'disabled' | 'error'
  connection?: ChannelConnection<ChannelTextMessage>
  config?: ChannelBaseConfig
  error?: string
}

export interface ChannelSessionBinding {
  channelType: string
  channelKey: string
  channelId: string
  sessionType: string
  replyReceiveId?: string
  replyReceiveIdType?: string
}

export interface SafeParseSchema {
  safeParse: (input: unknown) => { success: boolean; data?: unknown; error?: { message: string } }
}

export interface LoadedChannelModule {
  connectChannel: (
    config: unknown,
    options?: ChannelConnectionOptions
  ) => Promise<ChannelConnection<ChannelTextMessage>>
  configSchema?: SafeParseSchema
}

export interface ChannelManager {
  states: Map<string, ChannelRuntimeState>
  handleSessionEvent: (sessionId: string, event: WSEvent) => Promise<void>
  closeAll: () => Promise<void>
}
