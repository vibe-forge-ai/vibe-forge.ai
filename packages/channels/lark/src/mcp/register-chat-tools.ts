import { z } from 'zod'

import type { RegisterServer } from './register-utils.js'
import { toJsonResult } from './register-utils.js'
import {
  larkChatLinkValiditySchema,
  larkChatMemberIdTypeSchema,
  larkChatSortTypeSchema,
  larkMemberIdTypeSchema
} from './types.js'

const optionalPageSizeSchema = z.number().int().min(1).max(100).optional()

const getChatSchema = z.object({
  chatId: z.string().optional().describe('Explicit chat_id; defaults to the bound channel chat'),
  userIdType: larkMemberIdTypeSchema.optional().describe('Owner/member id type in the response')
})

const listChatsSchema = z.object({
  query: z.string().optional().describe('Optional search query; when omitted, list current chats'),
  userIdType: larkMemberIdTypeSchema.optional().describe('Owner/member id type in the response'),
  sortType: larkChatSortTypeSchema.optional().describe('Sort order for list mode'),
  pageSize: optionalPageSizeSchema.describe('Max number of chats to return'),
  pageToken: z.string().optional().describe('Pagination token')
})

const listChatMembersSchema = z.object({
  chatId: z.string().optional().describe('Explicit chat_id; defaults to the bound channel chat'),
  memberIdType: larkMemberIdTypeSchema.optional().describe('member_id_type for the response'),
  pageSize: optionalPageSizeSchema.describe('Max number of members to return'),
  pageToken: z.string().optional().describe('Pagination token')
})

const addChatMembersSchema = z.object({
  memberIds: z.array(z.string().min(1)).min(1).describe('User or bot IDs to add'),
  chatId: z.string().optional().describe('Explicit chat_id; defaults to the bound channel chat'),
  memberIdType: larkChatMemberIdTypeSchema.optional().describe('ID type of memberIds'),
  succeedType: z.number().int().optional().describe('Optional Lark succeed_type value')
})

const removeChatMembersSchema = z.object({
  memberIds: z.array(z.string().min(1)).min(1).describe('User or bot IDs to remove'),
  chatId: z.string().optional().describe('Explicit chat_id; defaults to the bound channel chat'),
  memberIdType: larkChatMemberIdTypeSchema.optional().describe('ID type of memberIds')
})

const getChatLinkSchema = z.object({
  chatId: z.string().optional().describe('Explicit chat_id; defaults to the bound channel chat'),
  validityPeriod: larkChatLinkValiditySchema.optional().describe('Validity period for the generated link')
})

const joinChatSchema = z.object({
  chatId: z.string().optional().describe('Explicit chat_id; defaults to the bound channel chat')
})

export const registerLarkChatTools = (
  server: RegisterServer,
  service: {
    getChat: (input: z.infer<typeof getChatSchema>) => Promise<unknown>
    listChats: (input: z.infer<typeof listChatsSchema>) => Promise<unknown>
    listChatMembers: (input: z.infer<typeof listChatMembersSchema>) => Promise<unknown>
    addChatMembers: (input: z.infer<typeof addChatMembersSchema>) => Promise<unknown>
    removeChatMembers: (input: z.infer<typeof removeChatMembersSchema>) => Promise<unknown>
    getChatLink: (input: z.infer<typeof getChatLinkSchema>) => Promise<unknown>
    joinChat: (input: z.infer<typeof joinChatSchema>) => Promise<unknown>
  }
) => {
  server.registerTool(
    'GetChat',
    {
      title: 'Get Chat',
      description: 'Get chat metadata for the bound chat by default, or for an explicit chat_id.',
      inputSchema: getChatSchema
    },
    async (input: z.infer<typeof getChatSchema>) => toJsonResult(await service.getChat(input))
  )

  server.registerTool(
    'ListChats',
    {
      title: 'List Chats',
      description: 'List visible chats, or search visible chats when query is provided.',
      inputSchema: listChatsSchema
    },
    async (input: z.infer<typeof listChatsSchema>) => toJsonResult(await service.listChats(input))
  )

  server.registerTool(
    'ListChatMembers',
    {
      title: 'List Chat Members',
      description: 'List members in the bound chat by default, or in an explicit chat_id.',
      inputSchema: listChatMembersSchema
    },
    async (input: z.infer<typeof listChatMembersSchema>) => toJsonResult(await service.listChatMembers(input))
  )

  server.registerTool(
    'AddChatMembers',
    {
      title: 'Add Chat Members',
      description: 'Invite users or bots into the bound chat by default, or into an explicit chat_id.',
      inputSchema: addChatMembersSchema
    },
    async (input: z.infer<typeof addChatMembersSchema>) => toJsonResult(await service.addChatMembers(input))
  )

  server.registerTool(
    'RemoveChatMembers',
    {
      title: 'Remove Chat Members',
      description: 'Remove users or bots from the bound chat by default, or from an explicit chat_id.',
      inputSchema: removeChatMembersSchema
    },
    async (input: z.infer<typeof removeChatMembersSchema>) => toJsonResult(await service.removeChatMembers(input))
  )

  server.registerTool(
    'GetChatLink',
    {
      title: 'Get Chat Link',
      description: 'Get a share link for the bound chat by default, or for an explicit chat_id.',
      inputSchema: getChatLinkSchema
    },
    async (input: z.infer<typeof getChatLinkSchema>) => toJsonResult(await service.getChatLink(input))
  )

  server.registerTool(
    'JoinChat',
    {
      title: 'Join Chat',
      description: 'Ask the bot to join a public chat. Defaults to the bound chat when available.',
      inputSchema: joinChatSchema
    },
    async (input: z.infer<typeof joinChatSchema>) => toJsonResult(await service.joinChat(input))
  )
}
