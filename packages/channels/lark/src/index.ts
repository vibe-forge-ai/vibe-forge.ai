import { z } from 'zod'

import { channelBaseSchema, defineChannel } from '@vibe-forge/core/channel'

export const larkChannelConfigSchema = channelBaseSchema.extend({
  type: z.literal('lark').describe('频道类型'),
  appId: z.string().min(1).describe('飞书 App ID'),
  appSecret: z.string().min(1).describe('飞书 App Secret')
})

export const larkChannelMessageSchema = z.object({
  receiveId: z.string().min(1).describe('接收方 ID'),
  receiveIdType: z.enum(['open_id', 'user_id', 'chat_id', 'email']).describe('接收方类型'),
  text: z.string().min(1).describe('消息文本')
})

export const larkChannelDefinition = defineChannel({
  type: 'lark',
  label: '飞书',
  description: '飞书消息通道',
  configSchema: larkChannelConfigSchema,
  messageSchema: larkChannelMessageSchema
})

export type LarkChannelConfig = z.infer<typeof larkChannelConfigSchema>
export type LarkChannelMessage = z.infer<typeof larkChannelMessageSchema>
export type LarkReceiveIdType = LarkChannelMessage['receiveIdType']

declare module '@vibe-forge/core' {
  interface ChannelMap {
    lark: Omit<LarkChannelConfig, 'type'>
  }
}
