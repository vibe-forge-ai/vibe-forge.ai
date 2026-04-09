import type {
  LarkFollowUpLanguage,
  LarkMemberIdType,
  LarkMcpRuntimeEnv,
  LarkUpdatableMessageType
} from './types.js'
import {
  ensureSuccess,
  resolveMessageContent
} from './shared.js'
import type { LarkImClient } from './shared.js'

const validateUpdatableMessageType = (msgType: string) => {
  if (msgType !== 'text' && msgType !== 'post') {
    throw new Error('Update message only supports msgType "text" or "post".')
  }
}

export const createLarkMessageLifecycleActions = (
  _env: LarkMcpRuntimeEnv,
  im: LarkImClient
) => ({
  replyMessage: async (input: {
    messageId: string
    msgType: string
    content: unknown
    replyInThread?: boolean
    uuid?: string
  }) => {
    const result = ensureSuccess(
      'Reply message',
      await im.message.reply({
        path: { message_id: input.messageId },
        data: {
          msg_type: input.msgType,
          content: resolveMessageContent(input.content),
          reply_in_thread: input.replyInThread,
          uuid: input.uuid
        }
      })
    ) as { data?: { message_id?: string } }

    return {
      sourceMessageId: input.messageId,
      msgType: input.msgType,
      messageId: result.data?.message_id
    }
  },
  updateMessage: async (input: {
    messageId: string
    msgType: LarkUpdatableMessageType
    content: unknown
  }) => {
    validateUpdatableMessageType(input.msgType)

    const result = ensureSuccess(
      'Update message',
      await im.message.update({
        path: { message_id: input.messageId },
        data: {
          msg_type: input.msgType,
          content: resolveMessageContent(input.content)
        }
      })
    ) as { data?: { message_id?: string } }

    return {
      messageId: result.data?.message_id ?? input.messageId,
      msgType: input.msgType
    }
  },
  patchMessage: async (input: {
    messageId: string
    content: unknown
  }) => {
    const result = ensureSuccess(
      'Patch message',
      await im.message.patch({
        path: { message_id: input.messageId },
        data: {
          content: resolveMessageContent(input.content)
        }
      })
    ) as { data?: unknown }
    return result.data ?? {}
  },
  pushFollowUps: async (input: {
    messageId: string
    followUps: Array<{
      content: string
      i18nContents?: Array<{
        content: string
        language: LarkFollowUpLanguage
      }>
    }>
  }) => {
    const result = ensureSuccess(
      'Push follow ups',
      await im.message.pushFollowUp({
        path: { message_id: input.messageId },
        data: {
          follow_ups: input.followUps.map(followUp => ({
            content: followUp.content,
            i18n_contents: followUp.i18nContents
          }))
        }
      })
    ) as { data?: unknown }
    return result.data ?? {}
  },
  getMessageReadUsers: async (input: {
    messageId: string
    userIdType?: LarkMemberIdType
    pageSize?: number
    pageToken?: string
  }) => {
    const result = ensureSuccess(
      'Get message read users',
      await im.message.readUsers({
        path: { message_id: input.messageId },
        params: {
          user_id_type: input.userIdType ?? 'open_id',
          page_size: input.pageSize,
          page_token: input.pageToken
        }
      })
    ) as { data?: unknown }
    return result.data ?? {}
  }
})
