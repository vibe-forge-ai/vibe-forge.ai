import type { LarkMcpRuntimeEnv, LarkMessageReceiveIdType } from './types.js'
import { ensureSuccess, resolveDefaultReceiveTarget } from './shared.js'
import type { LarkImClient } from './shared.js'

export const createSendTemplateCardAction = (
  env: LarkMcpRuntimeEnv,
  im: LarkImClient
) => async (input: {
  templateId: string
  templateVariable?: Record<string, unknown>
  receiveId?: string
  receiveIdType?: LarkMessageReceiveIdType
  uuid?: string
}) => {
  const target = resolveDefaultReceiveTarget(env, input)
  const result = ensureSuccess(
    'Send template card',
    await im.message.createByCard({
      params: {
        receive_id_type: target.receiveIdType
      },
      data: {
        receive_id: target.receiveId,
        template_id: input.templateId,
        template_variable: input.templateVariable,
        uuid: input.uuid
      }
    })
  ) as { data?: { message_id?: string } }

  return {
    templateId: input.templateId,
    receiveId: target.receiveId,
    receiveIdType: target.receiveIdType,
    messageId: result.data?.message_id
  }
}
