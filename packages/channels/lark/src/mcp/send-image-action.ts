import { stat } from 'node:fs/promises'

import {
  MAX_IM_IMAGE_SIZE,
  createFileReadStream,
  ensureSuccess,
  resolveDefaultReceiveTarget,
  resolveExistingFilePath
} from './shared.js'
import type { LarkImClient } from './shared.js'
import type { LarkMcpRuntimeEnv, LarkMessageReceiveIdType } from './types.js'

export const createSendImageAction = (
  env: LarkMcpRuntimeEnv,
  im: LarkImClient
) =>
async (input: {
  imagePath: string
  receiveId?: string
  receiveIdType?: LarkMessageReceiveIdType
  uuid?: string
  confirmExternalShare: true
}) => {
  if (input.confirmExternalShare !== true) {
    throw new Error('Send image requires confirmExternalShare=true.')
  }

  const resolvedImagePath = await resolveExistingFilePath(input.imagePath)
  const imageStats = await stat(resolvedImagePath)
  if (!imageStats.isFile()) {
    throw new Error(`Image not found: ${resolvedImagePath}`)
  }
  if (imageStats.size <= 0) {
    throw new Error(`Image is empty: ${resolvedImagePath}`)
  }
  if (imageStats.size > MAX_IM_IMAGE_SIZE) {
    throw new Error(`Image exceeds 10MB IM upload limit: ${resolvedImagePath}`)
  }

  const uploaded = ensureSuccess(
    'Upload image',
    await im.image.create({
      data: {
        image_type: 'message',
        image: createFileReadStream(resolvedImagePath)
      }
    })
  ) as { image_key?: string }
  if (uploaded.image_key == null || uploaded.image_key === '') {
    throw new Error('Upload image failed: missing image_key')
  }

  const target = resolveDefaultReceiveTarget(env, input)
  const result = ensureSuccess(
    'Send image message',
    await im.message.create({
      params: {
        receive_id_type: target.receiveIdType
      },
      data: {
        receive_id: target.receiveId,
        msg_type: 'image',
        content: JSON.stringify({ image_key: uploaded.image_key }),
        uuid: input.uuid
      }
    })
  ) as { data?: { message_id?: string } }

  return {
    imagePath: resolvedImagePath,
    imageKey: uploaded.image_key,
    receiveId: target.receiveId,
    receiveIdType: target.receiveIdType,
    messageId: result.data?.message_id
  }
}
