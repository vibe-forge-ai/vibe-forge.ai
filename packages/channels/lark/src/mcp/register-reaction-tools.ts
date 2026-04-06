import { z } from 'zod'

import { larkMemberIdTypeSchema } from './types.js'
import type { RegisterServer } from './register-utils.js'
import { toJsonResult } from './register-utils.js'

const optionalPageSizeSchema = z.number().int().min(1).max(100).optional()

const addMessageReactionSchema = z.object({
  messageId: z.string().min(1).describe('Target Lark message_id'),
  emojiType: z.string().min(1).describe('Emoji code to add as a reaction')
})

const deleteMessageReactionSchema = z.object({
  messageId: z.string().min(1).describe('Target Lark message_id'),
  reactionId: z.string().min(1).describe('Reaction ID returned by the reaction list/create APIs')
})

const listMessageReactionsSchema = z.object({
  messageId: z.string().min(1).describe('Target Lark message_id'),
  reactionType: z.string().optional().describe('Optional emoji code filter'),
  pageToken: z.string().optional().describe('Pagination token'),
  pageSize: optionalPageSizeSchema.describe('Max number of reactions to return'),
  userIdType: larkMemberIdTypeSchema.optional().describe('Operator id type in the response')
})

export const registerLarkReactionTools = (
  server: RegisterServer,
  service: {
    addMessageReaction: (input: z.infer<typeof addMessageReactionSchema>) => Promise<unknown>
    deleteMessageReaction: (input: z.infer<typeof deleteMessageReactionSchema>) => Promise<unknown>
    listMessageReactions: (input: z.infer<typeof listMessageReactionsSchema>) => Promise<unknown>
  }
) => {
  server.registerTool(
    'AddMessageReaction',
    {
      title: 'Add Message Reaction',
      description: 'Add a reaction to a Lark message.',
      inputSchema: addMessageReactionSchema
    },
    async (input: z.infer<typeof addMessageReactionSchema>) => toJsonResult(await service.addMessageReaction(input))
  )

  server.registerTool(
    'DeleteMessageReaction',
    {
      title: 'Delete Message Reaction',
      description: 'Delete a reaction from a Lark message.',
      inputSchema: deleteMessageReactionSchema
    },
    async (input: z.infer<typeof deleteMessageReactionSchema>) => toJsonResult(await service.deleteMessageReaction(input))
  )

  server.registerTool(
    'ListMessageReactions',
    {
      title: 'List Message Reactions',
      description: 'List reactions on a Lark message.',
      inputSchema: listMessageReactionsSchema
    },
    async (input: z.infer<typeof listMessageReactionsSchema>) => toJsonResult(await service.listMessageReactions(input))
  )
}
