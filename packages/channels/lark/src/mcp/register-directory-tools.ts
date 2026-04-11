import { z } from 'zod'

import type { RegisterServer } from './register-utils.js'
import { toJsonResult } from './register-utils.js'
import { larkDepartmentIdTypeSchema, larkMemberIdTypeSchema } from './types.js'

const optionalPageSizeSchema = z.number().int().min(1).max(100).optional()

const getUserSchema = z.object({
  userId: z.string().min(1).describe('The target user ID'),
  userIdType: larkMemberIdTypeSchema.optional().describe('Type of userId'),
  departmentIdType: larkDepartmentIdTypeSchema.optional().describe(
    'Department ID type used in returned department fields'
  )
})

const resolveUserIdsSchema = z.object({
  emails: z.array(z.string().email()).optional().describe('User emails to resolve'),
  mobiles: z.array(z.string().min(1)).optional().describe('User mobile numbers to resolve'),
  includeResigned: z.boolean().optional().describe('Whether to include resigned users'),
  userIdType: larkMemberIdTypeSchema.optional().describe('Requested output user ID type')
}).refine(
  input => (input.emails?.length ?? 0) > 0 || (input.mobiles?.length ?? 0) > 0,
  'Provide at least one email or mobile number.'
)

const findUsersByDepartmentSchema = z.object({
  departmentId: z.string().min(1).describe('Department ID; use 0 for the root department'),
  userIdType: larkMemberIdTypeSchema.optional().describe('Returned user ID type'),
  departmentIdType: larkDepartmentIdTypeSchema.optional().describe('Type of departmentId'),
  pageSize: optionalPageSizeSchema.describe('Max number of users to return'),
  pageToken: z.string().optional().describe('Pagination token')
})

export const registerLarkDirectoryTools = (
  server: RegisterServer,
  service: {
    getUser: (input: z.infer<typeof getUserSchema>) => Promise<unknown>
    resolveUserIds: (input: z.infer<typeof resolveUserIdsSchema>) => Promise<unknown>
    findUsersByDepartment: (input: z.infer<typeof findUsersByDepartmentSchema>) => Promise<unknown>
  }
) => {
  server.registerTool(
    'GetUser',
    {
      title: 'Get User',
      description: 'Get a single Lark user profile from the directory.',
      inputSchema: getUserSchema
    },
    async (input: z.infer<typeof getUserSchema>) => toJsonResult(await service.getUser(input))
  )

  server.registerTool(
    'ResolveUserIds',
    {
      title: 'Resolve User IDs',
      description: 'Resolve visible Lark user IDs from emails or mobile numbers.',
      inputSchema: resolveUserIdsSchema
    },
    async (input: z.infer<typeof resolveUserIdsSchema>) => toJsonResult(await service.resolveUserIds(input))
  )

  server.registerTool(
    'FindUsersByDepartment',
    {
      title: 'Find Users By Department',
      description: 'List direct users under a Lark department.',
      inputSchema: findUsersByDepartmentSchema
    },
    async (input: z.infer<typeof findUsersByDepartmentSchema>) =>
      toJsonResult(await service.findUsersByDepartment(input))
  )
}
