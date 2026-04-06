import { stat } from 'node:fs/promises'

import type {
  LarkFileType,
  LarkForwardReceiveIdType,
  LarkMemberIdType,
  LarkMcpRuntimeEnv,
  LarkMessageReceiveIdType
} from './types.js'
import {
  createFileReadStream,
  ensureSuccess,
  MAX_IM_FILE_SIZE,
  resolveDefaultReceiveTarget,
  resolveExistingFilePath,
  resolveLarkFileType,
  resolveUploadFileName
} from './shared.js'
import type { LarkImClient } from './shared.js'
import { createSendImageAction } from './send-image-action.js'
import { createSendRawMessageAction } from './send-raw-message-action.js'
import { createSendTemplateCardAction } from './send-template-card-action.js'

export const createLarkMessageActions = (
  env: LarkMcpRuntimeEnv,
  im: LarkImClient
) => ({
  sendImage: createSendImageAction(env, im),
  sendRawMessage: createSendRawMessageAction(env, im),
  sendTemplateCard: createSendTemplateCardAction(env, im),
  sendTextMessage: async (input: {
    text: string
    receiveId?: string
    receiveIdType?: LarkMessageReceiveIdType
    uuid?: string
  }) => {
    const target = resolveDefaultReceiveTarget(env, input)
    const result = ensureSuccess(
      'Send text message',
      await im.message.create({
        params: {
          receive_id_type: target.receiveIdType
        },
        data: {
          receive_id: target.receiveId,
          msg_type: 'text',
          content: JSON.stringify({ text: input.text }),
          uuid: input.uuid
        }
      })
    ) as { data?: { message_id?: string } }
    return {
      receiveId: target.receiveId,
      receiveIdType: target.receiveIdType,
      messageId: result.data?.message_id
    }
  },
  sendFile: async (input: {
    filePath: string
    fileType?: LarkFileType
    displayName?: string
    receiveId?: string
    receiveIdType?: LarkMessageReceiveIdType
    uuid?: string
    confirmExternalShare: true
  }) => {
    if (input.confirmExternalShare !== true) {
      throw new Error('Send file requires confirmExternalShare=true.')
    }

    const resolvedFilePath = await resolveExistingFilePath(input.filePath)
    const fileStats = await stat(resolvedFilePath)
    if (!fileStats.isFile()) {
      throw new Error(`File not found: ${resolvedFilePath}`)
    }
    if (fileStats.size <= 0) {
      throw new Error(`File is empty: ${resolvedFilePath}`)
    }
    if (fileStats.size > MAX_IM_FILE_SIZE) {
      throw new Error(`File exceeds 30MB IM upload limit: ${resolvedFilePath}`)
    }

    const fileName = resolveUploadFileName(resolvedFilePath, input.displayName)
    const resolvedFileType = resolveLarkFileType(fileName, input.fileType)
    const uploaded = ensureSuccess(
      'Upload file',
      await im.file.create({
        data: {
          file_type: resolvedFileType,
          file_name: fileName,
          file: createFileReadStream(resolvedFilePath)
        }
      })
    ) as { file_key?: string }
    if (uploaded.file_key == null || uploaded.file_key === '') {
      throw new Error('Upload file failed: missing file_key')
    }

    const target = resolveDefaultReceiveTarget(env, input)
    const result = ensureSuccess(
      'Send file message',
      await im.message.create({
        params: {
          receive_id_type: target.receiveIdType
        },
        data: {
          receive_id: target.receiveId,
          msg_type: 'file',
          content: JSON.stringify({ file_key: uploaded.file_key }),
          uuid: input.uuid
        }
      })
    ) as { data?: { message_id?: string } }

    return {
      filePath: resolvedFilePath,
      fileName,
      fileType: resolvedFileType,
      fileKey: uploaded.file_key,
      receiveId: target.receiveId,
      receiveIdType: target.receiveIdType,
      messageId: result.data?.message_id
    }
  },
  getMessage: async (input: {
    messageId: string
    userIdType?: LarkMemberIdType
  }) => {
    const result = ensureSuccess(
      'Get message',
      await im.message.get({
        path: { message_id: input.messageId },
        params: input.userIdType == null ? undefined : { user_id_type: input.userIdType }
      })
    ) as { data?: unknown }
    return result.data ?? {}
  },
  deleteMessage: async (input: {
    messageId: string
  }) => {
    const result = ensureSuccess(
      'Delete message',
      await im.message.delete({
        path: { message_id: input.messageId }
      })
    ) as { data?: unknown }
    return result.data ?? {}
  },
  forwardMessage: async (input: {
    messageId: string
    receiveId?: string
    receiveIdType?: LarkForwardReceiveIdType
    uuid?: string
  }) => {
    const receiveId = input.receiveId ?? env.defaultReceiveId ?? env.channelId
    const receiveIdType = input.receiveIdType ?? env.defaultReceiveIdType ?? 'chat_id'
    if (receiveId == null || receiveId.trim() === '') {
      throw new Error('Missing forward target. Provide receiveId explicitly or start from a bound Lark channel session.')
    }
    const result = ensureSuccess(
      'Forward message',
      await im.message.forward({
        path: { message_id: input.messageId },
        params: {
          receive_id_type: receiveIdType,
          uuid: input.uuid
        },
        data: {
          receive_id: receiveId
        }
      })
    ) as { data?: unknown }
    return result.data ?? {}
  }
})
