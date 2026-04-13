import { ensureSuccess } from './shared.js'
import type { LarkImClient } from './shared.js'
import type { LarkMcpRuntimeEnv, LarkMemberIdType } from './types.js'

export const createLarkReactionActions = (
  _env: LarkMcpRuntimeEnv,
  im: LarkImClient
) => ({
  addMessageReaction: async (input: {
    messageId: string
    emojiType: string
  }) => {
    const result = ensureSuccess(
      'Add message reaction',
      await im.messageReaction.create({
        path: { message_id: input.messageId },
        data: {
          reaction_type: {
            emoji_type: input.emojiType
          }
        }
      })
    ) as { data?: unknown }
    return result.data ?? {}
  },
  deleteMessageReaction: async (input: {
    messageId: string
    reactionId: string
  }) => {
    const result = ensureSuccess(
      'Delete message reaction',
      await im.messageReaction.delete({
        path: {
          message_id: input.messageId,
          reaction_id: input.reactionId
        }
      })
    ) as { data?: unknown }
    return result.data ?? {}
  },
  listMessageReactions: async (input: {
    messageId: string
    reactionType?: string
    pageToken?: string
    pageSize?: number
    userIdType?: LarkMemberIdType
  }) => {
    const result = ensureSuccess(
      'List message reactions',
      await im.messageReaction.list({
        path: { message_id: input.messageId },
        params: {
          reaction_type: input.reactionType,
          page_token: input.pageToken,
          page_size: input.pageSize,
          user_id_type: input.userIdType
        }
      })
    ) as { data?: unknown }
    return result.data ?? {}
  }
})
