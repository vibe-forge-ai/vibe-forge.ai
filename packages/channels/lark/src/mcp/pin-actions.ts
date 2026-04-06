import type { LarkMcpRuntimeEnv } from './types.js'
import { ensureSuccess, resolveDefaultChatId } from './shared.js'
import type { LarkImClient } from './shared.js'

export const createLarkPinActions = (
  env: LarkMcpRuntimeEnv,
  im: LarkImClient
) => ({
  pinMessage: async (input: {
    messageId: string
  }) => {
    const result = ensureSuccess(
      'Pin message',
      await im.pin.create({
        data: {
          message_id: input.messageId
        }
      })
    ) as { data?: unknown }
    return result.data ?? {}
  },
  unpinMessage: async (input: {
    messageId: string
  }) => {
    const result = ensureSuccess(
      'Unpin message',
      await im.pin.delete({
        path: {
          message_id: input.messageId
        }
      })
    ) as { data?: unknown }
    return result.data ?? {}
  },
  listPins: async (input?: {
    chatId?: string
    startTime?: string
    endTime?: string
    pageSize?: number
    pageToken?: string
  }) => {
    const chatId = resolveDefaultChatId(env, input?.chatId)
    const result = ensureSuccess(
      'List pins',
      await im.pin.list({
        params: {
          chat_id: chatId,
          start_time: input?.startTime,
          end_time: input?.endTime,
          page_size: input?.pageSize,
          page_token: input?.pageToken
        }
      })
    ) as { data?: unknown }
    return result.data ?? {}
  }
})
