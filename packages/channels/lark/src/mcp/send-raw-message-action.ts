import { ensureSuccess, resolveDefaultReceiveTarget, resolveMessageContent } from './shared.js'
import type { LarkImClient } from './shared.js'
import type { LarkMcpRuntimeEnv, LarkMessageReceiveIdType } from './types.js'

export const createSendRawMessageAction = (
  env: LarkMcpRuntimeEnv,
  im: LarkImClient
) =>
async (input: {
  msgType: string
  content: unknown
  receiveId?: string
  receiveIdType?: LarkMessageReceiveIdType
  uuid?: string
}) => {
  const target = resolveDefaultReceiveTarget(env, input)
  const result = ensureSuccess(
    'Send raw message',
    await im.message.create({
      params: {
        receive_id_type: target.receiveIdType
      },
      data: {
        receive_id: target.receiveId,
        msg_type: input.msgType,
        content: resolveMessageContent(input.content),
        uuid: input.uuid
      }
    })
  ) as { data?: { message_id?: string } }

  return {
    msgType: input.msgType,
    receiveId: target.receiveId,
    receiveIdType: target.receiveIdType,
    messageId: result.data?.message_id
  }
}
