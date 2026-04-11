import { z } from 'zod'

import type { RegisterServer } from './register-utils.js'
import { toJsonResult } from './register-utils.js'
import { larkMemberIdTypeSchema } from './types.js'

const createChatSchema = z.object({
  name: z.string().optional().describe('Chat name'),
  description: z.string().optional().describe('Chat description'),
  ownerId: z.string().optional().describe('Owner user ID'),
  userIdList: z.array(z.string().min(1)).optional().describe('Users to add when creating the chat'),
  botIdList: z.array(z.string().min(1)).optional().describe('Bots to add when creating the chat'),
  groupMessageType: z.enum(['chat', 'thread']).optional().describe('Chat message style'),
  external: z.boolean().optional().describe('Whether to create an external chat'),
  setBotManager: z.boolean().optional().describe('Whether to set the bot as a manager when supported'),
  userIdType: larkMemberIdTypeSchema.optional().describe('ID type used in ownerId and userIdList'),
  uuid: z.string().optional().describe('Optional deduplication uuid for chat creation')
})

const updateChatSchema = z.object({
  chatId: z.string().optional().describe('Explicit chat_id; defaults to the bound channel chat'),
  name: z.string().optional().describe('Chat name'),
  description: z.string().optional().describe('Chat description'),
  ownerId: z.string().optional().describe('New owner user ID'),
  addMemberPermission: z.string().optional().describe('Raw add_member_permission value'),
  shareCardPermission: z.string().optional().describe('Raw share_card_permission value'),
  atAllPermission: z.string().optional().describe('Raw at_all_permission value'),
  editPermission: z.string().optional().describe('Raw edit_permission value'),
  joinMessageVisibility: z.string().optional().describe('Raw join_message_visibility value'),
  leaveMessageVisibility: z.string().optional().describe('Raw leave_message_visibility value'),
  membershipApproval: z.string().optional().describe('Raw membership_approval value'),
  groupMessageType: z.enum(['chat', 'thread']).optional().describe('Chat message style'),
  urgentSetting: z.enum(['only_owner', 'all_members']).optional().describe('Urgent permission setting'),
  videoConferenceSetting: z.enum(['only_owner', 'all_members']).optional().describe(
    'Video conference permission setting'
  ),
  pinManageSetting: z.enum(['only_owner', 'all_members']).optional().describe('Pin management permission setting'),
  hideMemberCountSetting: z.enum(['all_members', 'only_owner']).optional().describe('Member count visibility setting'),
  userIdType: larkMemberIdTypeSchema.optional().describe('ID type used in ownerId')
})

const deleteChatSchema = z.object({
  chatId: z.string().min(1).describe('Explicit chat_id to dissolve'),
  confirmDelete: z.literal(true).describe('Must be true to confirm dissolving the chat')
})

export const registerLarkChatManagementTools = (
  server: RegisterServer,
  service: {
    createChat: (input: z.infer<typeof createChatSchema>) => Promise<unknown>
    updateChat: (input: z.infer<typeof updateChatSchema>) => Promise<unknown>
    deleteChat: (input: z.infer<typeof deleteChatSchema>) => Promise<unknown>
  }
) => {
  server.registerTool(
    'CreateChat',
    {
      title: 'Create Chat',
      description: 'Create a new Lark chat with an optional initial member set.',
      inputSchema: createChatSchema
    },
    async (input: z.infer<typeof createChatSchema>) => toJsonResult(await service.createChat(input))
  )

  server.registerTool(
    'UpdateChat',
    {
      title: 'Update Chat',
      description: 'Update chat metadata for the bound chat by default.',
      inputSchema: updateChatSchema
    },
    async (input: z.infer<typeof updateChatSchema>) => toJsonResult(await service.updateChat(input))
  )

  server.registerTool(
    'DeleteChat',
    {
      title: 'Delete Chat',
      description: 'Dissolve an explicit chat_id. This is destructive and requires explicit confirmation.',
      inputSchema: deleteChatSchema
    },
    async (input: z.infer<typeof deleteChatSchema>) => toJsonResult(await service.deleteChat(input))
  )
}
