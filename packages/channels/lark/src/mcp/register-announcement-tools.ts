import { z } from 'zod'

import type { RegisterServer } from './register-utils.js'
import { toJsonResult } from './register-utils.js'
import { larkMemberIdTypeSchema } from './types.js'

const getChatAnnouncementSchema = z.object({
  chatId: z.string().optional().describe('Explicit chat_id; defaults to the bound channel chat'),
  userIdType: larkMemberIdTypeSchema.optional().describe('Owner/member id type in the response')
})

const updateChatAnnouncementSchema = z.object({
  chatId: z.string().optional().describe('Explicit chat_id; defaults to the bound channel chat'),
  revision: z.string().min(1).describe('Current announcement revision returned by GetChatAnnouncement'),
  requests: z.array(z.string().min(1)).min(1).describe('Raw Feishu announcement patch requests')
})

export const registerLarkAnnouncementTools = (
  server: RegisterServer,
  service: {
    getChatAnnouncement: (input: z.infer<typeof getChatAnnouncementSchema>) => Promise<unknown>
    updateChatAnnouncement: (input: z.infer<typeof updateChatAnnouncementSchema>) => Promise<unknown>
  }
) => {
  server.registerTool(
    'GetChatAnnouncement',
    {
      title: 'Get Chat Announcement',
      description: 'Get the announcement document metadata for the bound chat by default.',
      inputSchema: getChatAnnouncementSchema
    },
    async (input: z.infer<typeof getChatAnnouncementSchema>) => toJsonResult(await service.getChatAnnouncement(input))
  )

  server.registerTool(
    'UpdateChatAnnouncement',
    {
      title: 'Update Chat Announcement',
      description: 'Patch the announcement document for the bound chat by default.',
      inputSchema: updateChatAnnouncementSchema
    },
    async (input: z.infer<typeof updateChatAnnouncementSchema>) =>
      toJsonResult(await service.updateChatAnnouncement(input))
  )
}
