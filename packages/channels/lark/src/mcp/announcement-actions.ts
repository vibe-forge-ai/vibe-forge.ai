import type { LarkMcpRuntimeEnv, LarkMemberIdType } from './types.js'
import { ensureSuccess, resolveDefaultChatId } from './shared.js'
import type { LarkImClient } from './shared.js'

export const createLarkAnnouncementActions = (
  env: LarkMcpRuntimeEnv,
  im: LarkImClient
) => ({
  getChatAnnouncement: async (input?: {
    chatId?: string
    userIdType?: LarkMemberIdType
  }) => {
    const chatId = resolveDefaultChatId(env, input?.chatId)
    const result = ensureSuccess(
      'Get chat announcement',
      await im.chatAnnouncement.get({
        path: { chat_id: chatId },
        params: input?.userIdType == null ? undefined : { user_id_type: input.userIdType }
      })
    ) as { data?: unknown }
    return result.data ?? {}
  },
  updateChatAnnouncement: async (input: {
    chatId?: string
    revision: string
    requests: string[]
  }) => {
    const chatId = resolveDefaultChatId(env, input.chatId)
    const result = ensureSuccess(
      'Update chat announcement',
      await im.chatAnnouncement.patch({
        path: { chat_id: chatId },
        data: {
          revision: input.revision,
          requests: input.requests
        }
      })
    ) as { data?: unknown }
    return result.data ?? {}
  }
})
