import { z } from 'zod'

export interface ChannelMap {}

export type ChannelType = keyof ChannelMap

export const channelBaseSchema = z.object({
  type: z.string().min(1).describe('频道类型'),
  title: z.string().optional().describe('频道标题'),
  description: z.string().optional().describe('频道说明'),
  enabled: z.boolean().optional().describe('是否启用'),
  admins: z.array(z.string()).optional().describe('频道管理员账号')
})

export type ChannelBaseConfig = z.infer<typeof channelBaseSchema>

export type ChannelConfigByType<K extends ChannelType> = ChannelBaseConfig & { type: K } & ChannelMap[K]

export type ChannelConfig = {
  [K in ChannelType]: ChannelConfigByType<K>
}[ChannelType]

export interface ChannelConnection<TMessage> {
  sendMessage: (message: TMessage) => Promise<void>
  startReceiving?: (options: {
    handlers: ChannelEventHandlers
  }) => Promise<void>
  close?: () => Promise<void>
}

export interface ChannelInboundEvent {
  channelType: string
  sessionType: string
  channelId: string
  senderId?: string
  messageId?: string
  text?: string
  replyTo?: {
    receiveId: string
    receiveIdType: string
  }
  ack?: () => Promise<void>
  unack?: () => Promise<void>
  raw: unknown
}

export type ChannelEventHandler<TPayload = unknown> = (payload: TPayload) => void | Promise<void>

export interface ChannelEventHandlers {
  message?: ChannelEventHandler<ChannelInboundEvent>
  [event: string]: ChannelEventHandler | ChannelEventHandler<ChannelInboundEvent> | undefined
}

export interface ChannelDescriptor<
  TConfigSchema extends z.ZodTypeAny = z.ZodTypeAny,
  TMessageSchema extends z.ZodTypeAny = z.ZodTypeAny,
> {
  type: string
  label: string
  description?: string
  configSchema: TConfigSchema
  messageSchema: TMessageSchema
}

export const defineChannelDescriptor = <TConfigSchema extends z.ZodTypeAny, TMessageSchema extends z.ZodTypeAny>(
  descriptor: ChannelDescriptor<TConfigSchema, TMessageSchema>
) => descriptor

export const defineChannel = <TConfigSchema extends z.ZodTypeAny, TMessageSchema extends z.ZodTypeAny>(
  descriptor: ChannelDescriptor<TConfigSchema, TMessageSchema>
) => descriptor

export const defineChannelConnection = <TConfigSchema extends z.ZodTypeAny, TMessageSchema extends z.ZodTypeAny>(
  connect: (config: z.infer<TConfigSchema>) => Promise<ChannelConnection<z.infer<TMessageSchema>>>
) => connect
