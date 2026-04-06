import type { LarkMcpRuntimeEnv } from './types.js'
import { ensureSuccess } from './shared.js'
import type { LarkImClient } from './shared.js'

export const createLarkCardActions = (
  _env: LarkMcpRuntimeEnv,
  im: LarkImClient
) => ({
  replyTemplateCard: async (input: {
    messageId: string
    templateId: string
    templateVariable?: Record<string, unknown>
    replyInThread?: boolean
    uuid?: string
  }) => {
    const result = ensureSuccess(
      'Reply template card',
      await im.message.replyByCard({
        path: { message_id: input.messageId },
        data: {
          template_id: input.templateId,
          template_variable: input.templateVariable,
          reply_in_thread: input.replyInThread,
          uuid: input.uuid
        }
      })
    ) as { data?: { message_id?: string } }

    return {
      templateId: input.templateId,
      sourceMessageId: input.messageId,
      messageId: result.data?.message_id
    }
  },
  updateTemplateCard: async (input: {
    messageId: string
    templateId: string
    templateVariable?: Record<string, unknown>
  }) => {
    const result = ensureSuccess(
      'Update template card',
      await im.message.updateByCard({
        path: { message_id: input.messageId },
        data: {
          template_id: input.templateId,
          template_variable: input.templateVariable
        }
      })
    ) as { data?: { message_id?: string } }

    return {
      templateId: input.templateId,
      messageId: result.data?.message_id ?? input.messageId
    }
  }
})
