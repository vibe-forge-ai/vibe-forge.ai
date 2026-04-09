import { z } from 'zod'

import type { RegisterServer } from './register-utils.js'
import { toJsonResult } from './register-utils.js'

const replyTemplateCardSchema = z.object({
  messageId: z.string().min(1).describe('Source Lark message_id to reply to'),
  templateId: z.string().min(1).describe('Lark message card template_id'),
  templateVariable: z.record(z.unknown()).optional().describe('Template variable object passed to the card template'),
  replyInThread: z.boolean().optional().describe('Whether to reply in thread when the source message is threaded'),
  uuid: z.string().optional().describe('Optional deduplication uuid for reply sending')
})

const updateTemplateCardSchema = z.object({
  messageId: z.string().min(1).describe('Target Lark message_id to update'),
  templateId: z.string().min(1).describe('Lark message card template_id'),
  templateVariable: z.record(z.unknown()).optional().describe('Template variable object passed to the card template')
})

export const registerLarkCardTools = (
  server: RegisterServer,
  service: {
    replyTemplateCard: (input: z.infer<typeof replyTemplateCardSchema>) => Promise<unknown>
    updateTemplateCard: (input: z.infer<typeof updateTemplateCardSchema>) => Promise<unknown>
  }
) => {
  server.registerTool(
    'ReplyTemplateCard',
    {
      title: 'Reply Template Card',
      description: 'Reply to a Lark message with a template card.',
      inputSchema: replyTemplateCardSchema
    },
    async (input: z.infer<typeof replyTemplateCardSchema>) => toJsonResult(await service.replyTemplateCard(input))
  )

  server.registerTool(
    'UpdateTemplateCard',
    {
      title: 'Update Template Card',
      description: 'Update an existing Lark template card message.',
      inputSchema: updateTemplateCardSchema
    },
    async (input: z.infer<typeof updateTemplateCardSchema>) => toJsonResult(await service.updateTemplateCard(input))
  )
}
