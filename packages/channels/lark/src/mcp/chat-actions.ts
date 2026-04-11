import { ensureSuccess, resolveDefaultChatId } from './shared.js'
import type { LarkImClient } from './shared.js'
import type {
  LarkChatLinkValidity,
  LarkChatMemberIdType,
  LarkChatSortType,
  LarkMcpRuntimeEnv,
  LarkMemberIdType
} from './types.js'

export const createLarkChatActions = (
  env: LarkMcpRuntimeEnv,
  im: LarkImClient
) => ({
  getChat: async (input?: {
    chatId?: string
    userIdType?: LarkMemberIdType
  }) => {
    const chatId = resolveDefaultChatId(env, input?.chatId)
    const result = ensureSuccess(
      'Get chat',
      await im.chat.get({
        path: { chat_id: chatId },
        params: input?.userIdType == null ? undefined : { user_id_type: input.userIdType }
      })
    ) as { data?: unknown }
    return result.data ?? {}
  },
  listChats: async (input?: {
    query?: string
    userIdType?: LarkMemberIdType
    sortType?: LarkChatSortType
    pageSize?: number
    pageToken?: string
  }) => {
    const params = {
      user_id_type: input?.userIdType,
      sort_type: input?.sortType,
      page_size: input?.pageSize,
      page_token: input?.pageToken
    }
    const result = ensureSuccess(
      input?.query?.trim()
        ? 'Search chats'
        : 'List chats',
      input?.query?.trim()
        ? await im.chat.search({
          params: {
            ...params,
            query: input.query.trim()
          }
        })
        : await im.chat.list({
          params
        })
    ) as { data?: unknown }
    return result.data ?? {}
  },
  listChatMembers: async (input?: {
    chatId?: string
    memberIdType?: LarkMemberIdType
    pageSize?: number
    pageToken?: string
  }) => {
    const chatId = resolveDefaultChatId(env, input?.chatId)
    const result = ensureSuccess(
      'List chat members',
      await im.chatMembers.get({
        path: { chat_id: chatId },
        params: {
          member_id_type: input?.memberIdType,
          page_size: input?.pageSize,
          page_token: input?.pageToken
        }
      })
    ) as { data?: unknown }
    return result.data ?? {}
  },
  addChatMembers: async (input: {
    memberIds: string[]
    chatId?: string
    memberIdType?: LarkChatMemberIdType
    succeedType?: number
  }) => {
    const chatId = resolveDefaultChatId(env, input.chatId)
    const result = ensureSuccess(
      'Add chat members',
      await im.chatMembers.create({
        path: { chat_id: chatId },
        params: {
          member_id_type: input.memberIdType,
          succeed_type: input.succeedType
        },
        data: {
          id_list: input.memberIds
        }
      })
    ) as { data?: unknown }
    return result.data ?? {}
  },
  removeChatMembers: async (input: {
    memberIds: string[]
    chatId?: string
    memberIdType?: LarkChatMemberIdType
  }) => {
    const chatId = resolveDefaultChatId(env, input.chatId)
    const result = ensureSuccess(
      'Remove chat members',
      await im.chatMembers.delete({
        path: { chat_id: chatId },
        params: {
          member_id_type: input.memberIdType
        },
        data: {
          id_list: input.memberIds
        }
      })
    ) as { data?: unknown }
    return result.data ?? {}
  },
  getChatLink: async (input?: {
    chatId?: string
    validityPeriod?: LarkChatLinkValidity
  }) => {
    const chatId = resolveDefaultChatId(env, input?.chatId)
    const result = ensureSuccess(
      'Get chat link',
      await im.chat.link({
        path: { chat_id: chatId },
        data: input?.validityPeriod == null
          ? undefined
          : { validity_period: input.validityPeriod }
      })
    ) as { data?: unknown }
    return result.data ?? {}
  },
  joinChat: async (input?: {
    chatId?: string
  }) => {
    const chatId = resolveDefaultChatId(env, input?.chatId)
    const result = ensureSuccess(
      'Join chat',
      await im.chatMembers.meJoin({
        path: { chat_id: chatId }
      })
    ) as { data?: unknown }
    return result.data ?? {}
  }
})
