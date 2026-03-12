import type { WSEvent } from '@vibe-forge/core'
import type { ChannelConnection } from '@vibe-forge/core/channel'

export interface ChannelRuntimeState {
  key: string
  type: string
  status: 'connected' | 'disabled' | 'error'
  connection?: ChannelConnection<ChannelTextMessage>
  error?: string
}

export interface ChannelTextMessage {
  receiveId: string
  receiveIdType: string
  text: string
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
  connectChannel: (config: unknown) => Promise<ChannelConnection<ChannelTextMessage>>
  configSchema?: SafeParseSchema
}

export interface ChannelManager {
  states: Map<string, ChannelRuntimeState>
  handleSessionEvent: (sessionId: string, event: WSEvent) => Promise<void>
  closeAll: () => Promise<void>
}
