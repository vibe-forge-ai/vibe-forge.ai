import { defineChannel } from '@vibe-forge/core/channel'

import { larkChannelConfigSchema, larkChannelMessageSchema } from '#~/types.js'
import type { LarkChannelConfig, LarkChannelMessage, LarkReceiveIdType } from '#~/types.js'

export const channelDefinition = defineChannel({
  type: 'lark',
  label: '飞书',
  description: '飞书消息通道',
  configSchema: larkChannelConfigSchema,
  messageSchema: larkChannelMessageSchema
})

export type { LarkChannelConfig, LarkChannelMessage, LarkReceiveIdType }

declare module '@vibe-forge/core' {
  interface ChannelMap {
    lark: Omit<LarkChannelConfig, 'type'>
  }
}
