import type {
  LarkForwardReceiveIdType,
  LarkMemberIdType,
  LarkMcpRuntimeEnv
} from './types.js'
import { ensureSuccess } from './shared.js'
import type { LarkImClient } from './shared.js'

const resolveForwardTarget = (
  env: LarkMcpRuntimeEnv,
  input?: {
    receiveId?: string
    receiveIdType?: LarkForwardReceiveIdType
  }
) => {
  const receiveId = input?.receiveId ?? env.defaultReceiveId ?? env.channelId
  const receiveIdType = input?.receiveIdType ?? env.defaultReceiveIdType ?? 'chat_id'
  if (receiveId == null || receiveId.trim() === '') {
    throw new Error('Missing forward target. Provide receiveId explicitly or start from a bound Lark channel session.')
  }
  return {
    receiveId,
    receiveIdType
  }
}

export const createLarkMessageAdvancedActions = (
  env: LarkMcpRuntimeEnv,
  im: LarkImClient
) => ({
  mergeForwardMessages: async (input: {
    messageIds: string[]
    receiveId?: string
    receiveIdType?: LarkForwardReceiveIdType
    uuid?: string
  }) => {
    const target = resolveForwardTarget(env, input)
    const result = ensureSuccess(
      'Merge forward messages',
      await im.message.mergeForward({
        params: {
          receive_id_type: target.receiveIdType,
          uuid: input.uuid
        },
        data: {
          receive_id: target.receiveId,
          message_id_list: input.messageIds
        }
      })
    ) as { data?: unknown }
    return result.data ?? {}
  },
  forwardThread: async (input: {
    threadId: string
    receiveId?: string
    receiveIdType?: LarkForwardReceiveIdType
    uuid?: string
  }) => {
    const target = resolveForwardTarget(env, input)
    const result = ensureSuccess(
      'Forward thread',
      await im.thread.forward({
        path: { thread_id: input.threadId },
        params: {
          receive_id_type: target.receiveIdType,
          uuid: input.uuid
        },
        data: {
          receive_id: target.receiveId
        }
      })
    ) as { data?: unknown }
    return result.data ?? {}
  },
  sendAppUrgent: async (input: {
    messageId: string
    userIds: string[]
    userIdType?: LarkMemberIdType
  }) => {
    const result = ensureSuccess(
      'Send app urgent',
      await im.message.urgentApp({
        path: { message_id: input.messageId },
        params: {
          user_id_type: input.userIdType ?? 'open_id'
        },
        data: {
          user_id_list: input.userIds
        }
      })
    ) as { data?: unknown }
    return result.data ?? {}
  },
  sendSmsUrgent: async (input: {
    messageId: string
    userIds: string[]
    userIdType?: LarkMemberIdType
    confirmQuotaUsage: true
  }) => {
    if (input.confirmQuotaUsage !== true) {
      throw new Error('Send SMS urgent requires confirmQuotaUsage=true.')
    }

    const result = ensureSuccess(
      'Send SMS urgent',
      await im.message.urgentSms({
        path: { message_id: input.messageId },
        params: {
          user_id_type: input.userIdType ?? 'open_id'
        },
        data: {
          user_id_list: input.userIds
        }
      })
    ) as { data?: unknown }
    return result.data ?? {}
  },
  sendPhoneUrgent: async (input: {
    messageId: string
    userIds: string[]
    userIdType?: LarkMemberIdType
    confirmQuotaUsage: true
  }) => {
    if (input.confirmQuotaUsage !== true) {
      throw new Error('Send phone urgent requires confirmQuotaUsage=true.')
    }

    const result = ensureSuccess(
      'Send phone urgent',
      await im.message.urgentPhone({
        path: { message_id: input.messageId },
        params: {
          user_id_type: input.userIdType ?? 'open_id'
        },
        data: {
          user_id_list: input.userIds
        }
      })
    ) as { data?: unknown }
    return result.data ?? {}
  }
})
