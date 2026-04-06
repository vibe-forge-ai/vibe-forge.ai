import { z } from 'zod'

import {
  larkFileTypeSchema,
  larkForwardReceiveIdTypeSchema,
  larkMemberIdTypeSchema,
  larkMessageReceiveIdTypeSchema
} from './types.js'
import type { RegisterServer } from './register-utils.js'
import { toJsonResult } from './register-utils.js'

const sendTextMessageSchema = z.object({
  text: z.string().min(1).describe('Message text'),
  receiveId: z.string().optional().describe('Explicit Lark receive_id'),
  receiveIdType: larkMessageReceiveIdTypeSchema.optional().describe('receive_id_type for the explicit target'),
  uuid: z.string().optional().describe('Optional deduplication uuid for Lark message sending')
})

const sendFileSchema = z.object({
  filePath: z.string().min(1).describe('Absolute or workspace-relative path to the local file'),
  fileType: larkFileTypeSchema.optional().describe('Override Lark IM file_type; defaults from file extension'),
  displayName: z.string().optional().describe('Override the filename shown in Lark'),
  receiveId: z.string().optional().describe('Explicit Lark receive_id'),
  receiveIdType: larkMessageReceiveIdTypeSchema.optional().describe('receive_id_type for the explicit target'),
  uuid: z.string().optional().describe('Optional deduplication uuid for Lark message sending'),
  confirmExternalShare: z.literal(true).describe('Must be true to confirm sending a local file outside the workspace')
})

const sendImageSchema = z.object({
  imagePath: z.string().min(1).describe('Absolute or workspace-relative path to the local image'),
  receiveId: z.string().optional().describe('Explicit Lark receive_id'),
  receiveIdType: larkMessageReceiveIdTypeSchema.optional().describe('receive_id_type for the explicit target'),
  uuid: z.string().optional().describe('Optional deduplication uuid for Lark message sending'),
  confirmExternalShare: z.literal(true).describe('Must be true to confirm sending a local image outside the workspace')
})

const sendRawMessageSchema = z.object({
  msgType: z.string().min(1).describe('Lark msg_type, for example interactive or post'),
  content: z.unknown().refine(
    value => typeof value === 'string' || (typeof value === 'object' && value != null),
    'Content must be a JSON string or a JSON-serializable object.'
  ).describe('Raw Lark message content payload'),
  receiveId: z.string().optional().describe('Explicit Lark receive_id'),
  receiveIdType: larkMessageReceiveIdTypeSchema.optional().describe('receive_id_type for the explicit target'),
  uuid: z.string().optional().describe('Optional deduplication uuid for Lark message sending')
})

const sendTemplateCardSchema = z.object({
  templateId: z.string().min(1).describe('Lark message card template_id'),
  templateVariable: z.record(z.unknown()).optional().describe('Template variable object passed to the card template'),
  receiveId: z.string().optional().describe('Explicit Lark receive_id'),
  receiveIdType: larkMessageReceiveIdTypeSchema.optional().describe('receive_id_type for the explicit target'),
  uuid: z.string().optional().describe('Optional deduplication uuid for card sending')
})

const getMessageSchema = z.object({
  messageId: z.string().min(1).describe('Lark message_id'),
  userIdType: larkMemberIdTypeSchema.optional().describe('sender id type in the response')
})

const deleteMessageSchema = z.object({
  messageId: z.string().min(1).describe('Lark message_id')
})

const forwardMessageSchema = z.object({
  messageId: z.string().min(1).describe('Lark message_id to forward'),
  receiveId: z.string().optional().describe('Explicit Lark receive_id'),
  receiveIdType: larkForwardReceiveIdTypeSchema.optional().describe('receive_id_type for the explicit target'),
  uuid: z.string().optional().describe('Optional deduplication uuid for forwarding')
})

export const registerLarkMessageTools = (
  server: RegisterServer,
  service: {
    sendTextMessage: (input: z.infer<typeof sendTextMessageSchema>) => Promise<unknown>
    sendFile: (input: z.infer<typeof sendFileSchema>) => Promise<unknown>
    sendImage: (input: z.infer<typeof sendImageSchema>) => Promise<unknown>
    sendRawMessage: (input: z.infer<typeof sendRawMessageSchema>) => Promise<unknown>
    sendTemplateCard: (input: z.infer<typeof sendTemplateCardSchema>) => Promise<unknown>
    getMessage: (input: z.infer<typeof getMessageSchema>) => Promise<unknown>
    deleteMessage: (input: z.infer<typeof deleteMessageSchema>) => Promise<unknown>
    forwardMessage: (input: z.infer<typeof forwardMessageSchema>) => Promise<unknown>
  }
) => {
  server.registerTool(
    'SendTextMessage',
    {
      title: 'Send Text Message',
      description: 'Send a text message to the bound chat by default, or to an explicit target.',
      inputSchema: sendTextMessageSchema
    },
    async (input: z.infer<typeof sendTextMessageSchema>) => toJsonResult(await service.sendTextMessage(input))
  )

  server.registerTool(
    'SendFile',
    {
      title: 'Send File',
      description: 'Upload a local workspace file to Lark IM and send it to the bound chat by default. Requires explicit share confirmation.',
      inputSchema: sendFileSchema
    },
    async (input: z.infer<typeof sendFileSchema>) => toJsonResult(await service.sendFile(input))
  )

  server.registerTool(
    'SendImage',
    {
      title: 'Send Image',
      description: 'Upload a local workspace image to Lark IM and send it to the bound chat by default. Requires explicit share confirmation.',
      inputSchema: sendImageSchema
    },
    async (input: z.infer<typeof sendImageSchema>) => toJsonResult(await service.sendImage(input))
  )

  server.registerTool(
    'SendRawMessage',
    {
      title: 'Send Raw Message',
      description: 'Send a raw Lark message payload such as interactive cards or post messages.',
      inputSchema: sendRawMessageSchema
    },
    async (input: z.infer<typeof sendRawMessageSchema>) => toJsonResult(await service.sendRawMessage(input))
  )

  server.registerTool(
    'SendTemplateCard',
    {
      title: 'Send Template Card',
      description: 'Send a Lark template card to the bound chat by default.',
      inputSchema: sendTemplateCardSchema
    },
    async (input: z.infer<typeof sendTemplateCardSchema>) => toJsonResult(await service.sendTemplateCard(input))
  )

  server.registerTool(
    'GetMessage',
    {
      title: 'Get Message',
      description: 'Get a message payload by message_id.',
      inputSchema: getMessageSchema
    },
    async (input: z.infer<typeof getMessageSchema>) => toJsonResult(await service.getMessage(input))
  )

  server.registerTool(
    'DeleteMessage',
    {
      title: 'Delete Message',
      description: 'Recall a message by message_id.',
      inputSchema: deleteMessageSchema
    },
    async (input: z.infer<typeof deleteMessageSchema>) => toJsonResult(await service.deleteMessage(input))
  )

  server.registerTool(
    'ForwardMessage',
    {
      title: 'Forward Message',
      description: 'Forward a message to the bound chat by default, or to an explicit target.',
      inputSchema: forwardMessageSchema
    },
    async (input: z.infer<typeof forwardMessageSchema>) => toJsonResult(await service.forwardMessage(input))
  )
}
