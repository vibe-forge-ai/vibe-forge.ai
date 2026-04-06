import { z } from 'zod'

import type { RegisterServer } from './register-utils.js'
import { toJsonResult } from './register-utils.js'

const optionalPageSizeSchema = z.number().int().min(1).max(100).optional()

const pinMessageSchema = z.object({
  messageId: z.string().min(1).describe('Target Lark message_id')
})

const unpinMessageSchema = z.object({
  messageId: z.string().min(1).describe('Target Lark message_id')
})

const listPinsSchema = z.object({
  chatId: z.string().optional().describe('Explicit chat_id; defaults to the bound channel chat'),
  startTime: z.string().optional().describe('Optional RFC3339 or millisecond timestamp string'),
  endTime: z.string().optional().describe('Optional RFC3339 or millisecond timestamp string'),
  pageSize: optionalPageSizeSchema.describe('Max number of pins to return'),
  pageToken: z.string().optional().describe('Pagination token')
})

export const registerLarkPinTools = (
  server: RegisterServer,
  service: {
    pinMessage: (input: z.infer<typeof pinMessageSchema>) => Promise<unknown>
    unpinMessage: (input: z.infer<typeof unpinMessageSchema>) => Promise<unknown>
    listPins: (input: z.infer<typeof listPinsSchema>) => Promise<unknown>
  }
) => {
  server.registerTool(
    'PinMessage',
    {
      title: 'Pin Message',
      description: 'Pin a Lark message in its chat.',
      inputSchema: pinMessageSchema
    },
    async (input: z.infer<typeof pinMessageSchema>) => toJsonResult(await service.pinMessage(input))
  )

  server.registerTool(
    'UnpinMessage',
    {
      title: 'Unpin Message',
      description: 'Remove a Lark message pin.',
      inputSchema: unpinMessageSchema
    },
    async (input: z.infer<typeof unpinMessageSchema>) => toJsonResult(await service.unpinMessage(input))
  )

  server.registerTool(
    'ListPins',
    {
      title: 'List Pins',
      description: 'List pinned messages for the bound chat by default.',
      inputSchema: listPinsSchema
    },
    async (input: z.infer<typeof listPinsSchema>) => toJsonResult(await service.listPins(input))
  )
}
