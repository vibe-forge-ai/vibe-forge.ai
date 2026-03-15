import type { Readable } from 'node:stream'

import { z } from 'zod'

import { channelBaseSchema } from '@vibe-forge/core/channel'

export const larkChannelConfigSchema = channelBaseSchema.extend({
  type: z
    .literal('lark')
    .describe('频道类型'),
  appId: z
    .string().min(1)
    .describe('飞书 App ID'),
  appSecret: z
    .string().min(1)
    .describe('飞书 App Secret'),
  domain: z
    .enum(['Feishu', 'Lark']).optional()
    .describe('飞书 Domain')
})

export const larkChannelMessageSchema = z.object({
  receiveId: z.string().min(1).describe('接收方 ID'),
  receiveIdType: z.enum(['open_id', 'user_id', 'chat_id', 'email']).describe('接收方类型'),
  text: z.string().min(1).describe('消息文本')
})

export type LarkChannelConfig = z.infer<typeof larkChannelConfigSchema>
export type LarkChannelMessage = z.infer<typeof larkChannelMessageSchema>
export type LarkReceiveIdType = LarkChannelMessage['receiveIdType']

export interface LarkMention {
  id?: {
    open_id?: string | null
    user_id?: string | null
    union_id?: string | null
  }
  key?: string
  name?: string
  tenant_key?: string
}

export interface LarkMessagePayload {
  event_type?: string
  message?: {
    chat_id?: string
    chat_type?: string
    content?: string
    message_id?: string
    mentions?: LarkMention[]
  }
  sender?: {
    sender_id?: {
      open_id?: string | null
      user_id?: string | null
      union_id?: string | null
    }
  }
}

export interface LarkRichNode {
  tag?: string
  text?: string
  user_id?: string
  user_name?: string
  image_key?: string
  width?: number
  height?: number
}

export type InboundContentItem =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string; name?: string; size?: number; mimeType?: string }

export interface ParsedLarkContent {
  rawText?: string
  formattedText?: string
  contentItems?: InboundContentItem[]
  images?: Array<{
    imageKey: string
    mimeType?: string
    size?: number
    dataUrl?: string
    width?: number
    height?: number
  }>
  rich?: unknown
}

export interface TenantAccessTokenResponse {
  code: number
  msg?: string
  tenant_access_token?: string
  expire?: number
}

export interface FetchResponse {
  ok: boolean
  status?: number
  json: () => Promise<unknown>
}

export interface TenantTokenCacheEntry {
  token: string
  expiresAt: number
}

export interface LarkImageDownloadResponse {
  getReadableStream: () => Readable
  headers: unknown
}

export type TenantTokenProvider = () => Promise<string | undefined>
