import { z } from 'zod'

import {
  larkMessageContainerTypeSchema,
  larkMessageSortTypeSchema
} from './types.js'
import type { RegisterServer } from './register-utils.js'
import { toJsonResult } from './register-utils.js'

const optionalPageSizeSchema = z.number().int().min(1).max(100).optional()
const recentSenderTypeSchema = z.enum(['user', 'app', 'anonymous', 'unknown'])

const listMessagesSchema = z.object({
  containerId: z.string().optional().describe('Explicit container id; defaults to the bound chat for chat container type'),
  containerType: larkMessageContainerTypeSchema.optional().describe('Message container type; defaults to chat'),
  startTime: z.string().optional().describe('Optional RFC3339 or millisecond timestamp string'),
  endTime: z.string().optional().describe('Optional RFC3339 or millisecond timestamp string'),
  sortType: larkMessageSortTypeSchema.optional().describe('Sort order for returned messages'),
  pageSize: optionalPageSizeSchema.describe('Max number of messages to return'),
  pageToken: z.string().optional().describe('Pagination token')
})

const getCurrentChatMessagesSchema = z.object({
  chatId: z.string().optional().describe('Optional explicit chat_id; defaults to the current bound Lark chat'),
  limit: z.number().int().min(1).max(50).optional().describe('Max number of matching messages to return; defaults to 10'),
  lookbackMinutes: z.number().int().min(1).max(7 * 24 * 60).optional()
    .describe('Only include messages from the last N minutes, useful for “刚刚在聊啥”'),
  query: z.string().optional().describe('Case-insensitive substring filter over normalized message text/summary'),
  senderType: recentSenderTypeSchema.optional().describe('Optional sender type filter'),
  includeRawContent: z.boolean().optional().describe('Include raw body.content JSON for each returned message')
})

export const registerLarkMessageHistoryTools = (
  server: RegisterServer,
  service: {
    listMessages: (input: z.infer<typeof listMessagesSchema>) => Promise<unknown>
    getCurrentChatMessages: (input: z.infer<typeof getCurrentChatMessagesSchema>) => Promise<unknown>
  }
) => {
  server.registerTool(
    'ListMessages',
    {
      title: 'List Messages',
      description: 'List message history for the bound chat by default, or for an explicit chat/thread container.',
      inputSchema: listMessagesSchema
    },
    async (input: z.infer<typeof listMessagesSchema>) => toJsonResult(await service.listMessages(input))
  )

  server.registerTool(
    'GetCurrentChatMessages',
    {
      title: 'Get Current Chat Messages',
      description: 'Fetch normalized recent messages from the current bound Lark chat, with simple recency and substring filters.',
      inputSchema: getCurrentChatMessagesSchema
    },
    async (input: z.infer<typeof getCurrentChatMessagesSchema>) => toJsonResult(await service.getCurrentChatMessages(input))
  )
}
