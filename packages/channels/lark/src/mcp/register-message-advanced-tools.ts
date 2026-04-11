import { z } from 'zod'

import type { RegisterServer } from './register-utils.js'
import { toJsonResult } from './register-utils.js'
import { larkForwardReceiveIdTypeSchema, larkMemberIdTypeSchema } from './types.js'

const mergeForwardMessagesSchema = z.object({
  messageIds: z.array(z.string().min(1)).min(1).describe('Message IDs to merge and forward'),
  receiveId: z.string().optional().describe('Explicit Lark receive_id'),
  receiveIdType: larkForwardReceiveIdTypeSchema.optional().describe('receive_id_type for the explicit target'),
  uuid: z.string().optional().describe('Optional deduplication uuid for forwarding')
})

const forwardThreadSchema = z.object({
  threadId: z.string().min(1).describe('Lark thread_id to forward'),
  receiveId: z.string().optional().describe('Explicit Lark receive_id'),
  receiveIdType: larkForwardReceiveIdTypeSchema.optional().describe('receive_id_type for the explicit target'),
  uuid: z.string().optional().describe('Optional deduplication uuid for forwarding')
})

const urgentBaseSchema = z.object({
  messageId: z.string().min(1).describe('Target Lark message_id'),
  userIds: z.array(z.string().min(1)).min(1).describe('Users to mark as urgent recipients'),
  userIdType: larkMemberIdTypeSchema.optional().describe('ID type used in userIds')
})

const chargeableUrgentSchema = urgentBaseSchema.extend({
  confirmQuotaUsage: z.literal(true).describe(
    'Must be true to acknowledge this action may consume enterprise urgent quota'
  )
})

export const registerLarkMessageAdvancedTools = (
  server: RegisterServer,
  service: {
    mergeForwardMessages: (input: z.infer<typeof mergeForwardMessagesSchema>) => Promise<unknown>
    forwardThread: (input: z.infer<typeof forwardThreadSchema>) => Promise<unknown>
    sendAppUrgent: (input: z.infer<typeof urgentBaseSchema>) => Promise<unknown>
    sendSmsUrgent: (input: z.infer<typeof chargeableUrgentSchema>) => Promise<unknown>
    sendPhoneUrgent: (input: z.infer<typeof chargeableUrgentSchema>) => Promise<unknown>
  }
) => {
  server.registerTool(
    'MergeForwardMessages',
    {
      title: 'Merge Forward Messages',
      description: 'Merge and forward multiple messages to the bound chat by default.',
      inputSchema: mergeForwardMessagesSchema
    },
    async (input: z.infer<typeof mergeForwardMessagesSchema>) => toJsonResult(await service.mergeForwardMessages(input))
  )

  server.registerTool(
    'ForwardThread',
    {
      title: 'Forward Thread',
      description: 'Forward a thread to the bound chat by default.',
      inputSchema: forwardThreadSchema
    },
    async (input: z.infer<typeof forwardThreadSchema>) => toJsonResult(await service.forwardThread(input))
  )

  server.registerTool(
    'SendAppUrgent',
    {
      title: 'Send App Urgent',
      description: 'Trigger in-app urgent delivery for a sent message.',
      inputSchema: urgentBaseSchema
    },
    async (input: z.infer<typeof urgentBaseSchema>) => toJsonResult(await service.sendAppUrgent(input))
  )

  server.registerTool(
    'SendSmsUrgent',
    {
      title: 'Send SMS Urgent',
      description:
        'Trigger SMS urgent delivery for a sent message. This consumes enterprise quota and requires explicit acknowledgement.',
      inputSchema: chargeableUrgentSchema
    },
    async (input: z.infer<typeof chargeableUrgentSchema>) => toJsonResult(await service.sendSmsUrgent(input))
  )

  server.registerTool(
    'SendPhoneUrgent',
    {
      title: 'Send Phone Urgent',
      description:
        'Trigger phone urgent delivery for a sent message. This consumes enterprise quota and requires explicit acknowledgement.',
      inputSchema: chargeableUrgentSchema
    },
    async (input: z.infer<typeof chargeableUrgentSchema>) => toJsonResult(await service.sendPhoneUrgent(input))
  )
}
