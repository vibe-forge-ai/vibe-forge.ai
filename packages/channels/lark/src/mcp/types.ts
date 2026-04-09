import process from 'node:process'

import { z } from 'zod'

export const larkDomainSchema = z.enum(['Feishu', 'Lark'])
export type LarkDomain = z.infer<typeof larkDomainSchema>

export const larkMessageReceiveIdTypeSchema = z.enum(['open_id', 'user_id', 'union_id', 'email', 'chat_id'])
export type LarkMessageReceiveIdType = z.infer<typeof larkMessageReceiveIdTypeSchema>

export const larkForwardReceiveIdTypeSchema = z.enum(['open_id', 'user_id', 'union_id', 'email', 'chat_id', 'thread_id'])
export type LarkForwardReceiveIdType = z.infer<typeof larkForwardReceiveIdTypeSchema>

export const larkMemberIdTypeSchema = z.enum(['user_id', 'union_id', 'open_id'])
export type LarkMemberIdType = z.infer<typeof larkMemberIdTypeSchema>

export const larkChatMemberIdTypeSchema = z.enum(['user_id', 'union_id', 'open_id', 'app_id'])
export type LarkChatMemberIdType = z.infer<typeof larkChatMemberIdTypeSchema>

export const larkDepartmentIdTypeSchema = z.enum(['department_id', 'open_department_id'])
export type LarkDepartmentIdType = z.infer<typeof larkDepartmentIdTypeSchema>

export const larkFileTypeSchema = z.enum(['opus', 'mp4', 'pdf', 'doc', 'xls', 'ppt', 'stream'])
export type LarkFileType = z.infer<typeof larkFileTypeSchema>

export const larkChatLinkValiditySchema = z.enum(['week', 'year', 'permanently'])
export type LarkChatLinkValidity = z.infer<typeof larkChatLinkValiditySchema>

export const larkChatSortTypeSchema = z.enum(['ByCreateTimeAsc', 'ByActiveTimeDesc'])
export type LarkChatSortType = z.infer<typeof larkChatSortTypeSchema>

export const larkMessageResourceTypeSchema = z.enum(['audio', 'video', 'image', 'file'])
export type LarkMessageResourceType = z.infer<typeof larkMessageResourceTypeSchema>

export const larkMessageContainerTypeSchema = z.enum(['chat', 'thread'])
export type LarkMessageContainerType = z.infer<typeof larkMessageContainerTypeSchema>

export const larkMessageSortTypeSchema = z.enum(['ByCreateTimeAsc', 'ByCreateTimeDesc'])
export type LarkMessageSortType = z.infer<typeof larkMessageSortTypeSchema>

export const larkUpdatableMessageTypeSchema = z.enum(['text', 'post'])
export type LarkUpdatableMessageType = z.infer<typeof larkUpdatableMessageTypeSchema>

export const larkFollowUpLanguageSchema = z.enum([
  'en_us',
  'zh_cn',
  'zh_hk',
  'zh_tw',
  'ja_jp',
  'id_id',
  'vi_vn',
  'th_th',
  'pt_br',
  'es_es',
  'ko_kr',
  'de_de',
  'fr_fr',
  'it_it',
  'ru_ru',
  'ms_my'
])
export type LarkFollowUpLanguage = z.infer<typeof larkFollowUpLanguageSchema>

export const larkPermissionOperationSchema = z.enum([
  'send_message',
  'send_file',
  'send_image',
  'send_raw_message',
  'send_template_card',
  'reply_template_card',
  'update_template_card',
  'merge_forward_messages',
  'forward_thread',
  'send_urgent_app',
  'send_urgent_sms',
  'send_urgent_phone',
  'reply_message',
  'update_message',
  'patch_message',
  'push_follow_up',
  'get_message_read_users',
  'get_chat',
  'get_chat_announcement',
  'update_chat_announcement',
  'list_chat_members',
  'manage_chat_members',
  'join_chat',
  'get_chat_link',
  'create_chat',
  'update_chat',
  'delete_chat',
  'list_messages',
  'manage_message_reaction',
  'list_message_reactions',
  'manage_pin',
  'list_pins',
  'download_file',
  'download_image',
  'download_message_resource',
  'get_user',
  'resolve_user_ids',
  'find_users_by_department'
])
export type LarkPermissionOperation = z.infer<typeof larkPermissionOperationSchema>

const larkMcpRuntimeEnvSchema = z.object({
  VF_LARK_APP_ID: z.string().min(1),
  VF_LARK_APP_SECRET: z.string().min(1),
  VF_LARK_DOMAIN: larkDomainSchema.optional(),
  VF_CHANNEL_SESSION_ID: z.string().optional(),
  VF_CHANNEL_KEY: z.string().optional(),
  VF_CHANNEL_TYPE: z.string().optional(),
  VF_CHANNEL_ID: z.string().optional(),
  VF_CHANNEL_SESSION_TYPE: z.string().optional(),
  VF_CHANNEL_REPLY_RECEIVE_ID: z.string().optional(),
  VF_CHANNEL_REPLY_RECEIVE_ID_TYPE: larkMessageReceiveIdTypeSchema.optional(),
  VF_LARK_DEFAULT_RECEIVE_ID: z.string().optional(),
  VF_LARK_DEFAULT_RECEIVE_ID_TYPE: larkMessageReceiveIdTypeSchema.optional()
})

export interface LarkMcpRuntimeEnv {
  appId: string
  appSecret: string
  domain: LarkDomain
  sessionId?: string
  channelKey?: string
  channelType?: string
  channelId?: string
  sessionType?: string
  replyReceiveId?: string
  replyReceiveIdType?: LarkMessageReceiveIdType
  defaultReceiveId?: string
  defaultReceiveIdType?: LarkMessageReceiveIdType
}

export const loadLarkMcpRuntimeEnv = (env: NodeJS.ProcessEnv = process.env): LarkMcpRuntimeEnv => {
  const parsed = larkMcpRuntimeEnvSchema.parse(env)
  return {
    appId: parsed.VF_LARK_APP_ID,
    appSecret: parsed.VF_LARK_APP_SECRET,
    domain: parsed.VF_LARK_DOMAIN ?? 'Feishu',
    sessionId: parsed.VF_CHANNEL_SESSION_ID,
    channelKey: parsed.VF_CHANNEL_KEY,
    channelType: parsed.VF_CHANNEL_TYPE,
    channelId: parsed.VF_CHANNEL_ID,
    sessionType: parsed.VF_CHANNEL_SESSION_TYPE,
    replyReceiveId: parsed.VF_CHANNEL_REPLY_RECEIVE_ID,
    replyReceiveIdType: parsed.VF_CHANNEL_REPLY_RECEIVE_ID_TYPE,
    defaultReceiveId: parsed.VF_LARK_DEFAULT_RECEIVE_ID ?? parsed.VF_CHANNEL_REPLY_RECEIVE_ID,
    defaultReceiveIdType: parsed.VF_LARK_DEFAULT_RECEIVE_ID_TYPE ?? parsed.VF_CHANNEL_REPLY_RECEIVE_ID_TYPE
  }
}
