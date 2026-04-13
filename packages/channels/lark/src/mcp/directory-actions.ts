import { ensureSuccess } from './shared.js'
import type { LarkContactClient } from './shared.js'
import type { LarkDepartmentIdType, LarkMcpRuntimeEnv, LarkMemberIdType } from './types.js'

const resolveContactUserApi = (contact?: LarkContactClient) => {
  const userApi = contact?.user
  if (userApi == null) {
    throw new Error('Lark SDK client missing contact.user namespace')
  }
  return userApi
}

export const createLarkDirectoryActions = (
  _env: LarkMcpRuntimeEnv,
  contact?: LarkContactClient
) => ({
  getUser: async (input: {
    userId: string
    userIdType?: LarkMemberIdType
    departmentIdType?: LarkDepartmentIdType
  }) => {
    const userApi = resolveContactUserApi(contact)
    const result = ensureSuccess(
      'Get user',
      await userApi.get({
        path: { user_id: input.userId },
        params: {
          user_id_type: input.userIdType,
          department_id_type: input.departmentIdType
        }
      })
    ) as { data?: { user?: unknown } }
    return result.data?.user ?? {}
  },
  resolveUserIds: async (input: {
    emails?: string[]
    mobiles?: string[]
    includeResigned?: boolean
    userIdType?: LarkMemberIdType
  }) => {
    const userApi = resolveContactUserApi(contact)
    const result = ensureSuccess(
      'Resolve user IDs',
      await userApi.batchGetId({
        params: input.userIdType == null ? undefined : { user_id_type: input.userIdType },
        data: {
          emails: input.emails,
          mobiles: input.mobiles,
          include_resigned: input.includeResigned
        }
      })
    ) as { data?: unknown }
    return result.data ?? {}
  },
  findUsersByDepartment: async (input: {
    departmentId: string
    userIdType?: LarkMemberIdType
    departmentIdType?: LarkDepartmentIdType
    pageSize?: number
    pageToken?: string
  }) => {
    const userApi = resolveContactUserApi(contact)
    const result = ensureSuccess(
      'Find users by department',
      await userApi.findByDepartment({
        params: {
          department_id: input.departmentId,
          user_id_type: input.userIdType,
          department_id_type: input.departmentIdType,
          page_size: input.pageSize,
          page_token: input.pageToken
        }
      })
    ) as { data?: unknown }
    return result.data ?? {}
  }
})
