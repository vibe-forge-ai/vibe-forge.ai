import { z } from 'zod'

import type { RegisterServer } from './register-utils.js'
import { toJsonResult } from './register-utils.js'
import { larkFollowUpLanguageSchema, larkMemberIdTypeSchema, larkUpdatableMessageTypeSchema } from './types.js'

const optionalPageSizeSchema = z.number().int().min(1).max(100).optional()

const rawContentSchema = z.unknown().refine(
  value => typeof value === 'string' || (typeof value === 'object' && value != null),
  'Content must be a JSON string or a JSON-serializable object.'
)

const replyMessageSchema = z.object({
  messageId: z.string().min(1).describe('Source Lark message_id'),
  msgType: z.string().min(1).describe('Lark msg_type to send in the reply'),
  content: rawContentSchema.describe('Raw reply content'),
  replyInThread: z.boolean().optional().describe('Whether to reply in thread when supported'),
  uuid: z.string().optional().describe('Optional deduplication uuid for reply sending')
})

const updateMessageSchema = z.object({
  messageId: z.string().min(1).describe('Target Lark message_id'),
  msgType: larkUpdatableMessageTypeSchema.describe('Lark msg_type to update; only text and post are supported'),
  content: rawContentSchema.describe('Raw updated content')
})

const patchMessageSchema = z.object({
  messageId: z.string().min(1).describe('Target Lark message_id'),
  content: rawContentSchema.describe('Shared card content payload')
})

const pushFollowUpsSchema = z.object({
  messageId: z.string().min(1).describe('Target Lark message_id'),
  followUps: z.array(z.object({
    content: z.string().min(1).describe('Follow-up content'),
    i18nContents: z.array(z.object({
      content: z.string().min(1).describe('Localized follow-up content'),
      language: larkFollowUpLanguageSchema.describe('Lark language code such as zh_cn or en_us')
    })).optional().describe('Optional localized variants')
  })).min(1).describe('Follow-up suggestions to attach to the message')
})

const getMessageReadUsersSchema = z.object({
  messageId: z.string().min(1).describe('Target Lark message_id'),
  userIdType: larkMemberIdTypeSchema.optional().describe('Requested user ID type in the response'),
  pageSize: optionalPageSizeSchema.describe('Max number of read users to return'),
  pageToken: z.string().optional().describe('Pagination token')
})

export const registerLarkMessageLifecycleTools = (
  server: RegisterServer,
  service: {
    replyMessage: (input: z.infer<typeof replyMessageSchema>) => Promise<unknown>
    updateMessage: (input: z.infer<typeof updateMessageSchema>) => Promise<unknown>
    patchMessage: (input: z.infer<typeof patchMessageSchema>) => Promise<unknown>
    pushFollowUps: (input: z.infer<typeof pushFollowUpsSchema>) => Promise<unknown>
    getMessageReadUsers: (input: z.infer<typeof getMessageReadUsersSchema>) => Promise<unknown>
  }
) => {
  server.registerTool(
    'ReplyMessage',
    {
      title: 'Reply Message',
      description: 'Reply to a Lark message with a raw message payload.',
      inputSchema: replyMessageSchema
    },
    async (input: z.infer<typeof replyMessageSchema>) => toJsonResult(await service.replyMessage(input))
  )

  server.registerTool(
    'UpdateMessage',
    {
      title: 'Update Message',
      description: 'Update a previously sent text or post message.',
      inputSchema: updateMessageSchema
    },
    async (input: z.infer<typeof updateMessageSchema>) => toJsonResult(await service.updateMessage(input))
  )

  server.registerTool(
    'PatchMessage',
    {
      title: 'Patch Message',
      description: 'Patch a shared card message payload.',
      inputSchema: patchMessageSchema
    },
    async (input: z.infer<typeof patchMessageSchema>) => toJsonResult(await service.patchMessage(input))
  )

  server.registerTool(
    'PushFollowUps',
    {
      title: 'Push Follow Ups',
      description: 'Attach follow-up suggestions to an existing message.',
      inputSchema: pushFollowUpsSchema
    },
    async (input: z.infer<typeof pushFollowUpsSchema>) => toJsonResult(await service.pushFollowUps(input))
  )

  server.registerTool(
    'GetMessageReadUsers',
    {
      title: 'Get Message Read Users',
      description: 'List users who have read a bot-sent message.',
      inputSchema: getMessageReadUsersSchema
    },
    async (input: z.infer<typeof getMessageReadUsersSchema>) => toJsonResult(await service.getMessageReadUsers(input))
  )
}
