import type {
  LarkMessageContainerType,
  LarkMessageSortType,
  LarkMcpRuntimeEnv
} from './types.js'
import { ensureSuccess, resolveDefaultChatId } from './shared.js'
import type { LarkImClient } from './shared.js'

const resolveContainerTarget = (
  env: LarkMcpRuntimeEnv,
  input?: {
    containerId?: string
    containerType?: LarkMessageContainerType
  }
) => {
  const containerType = input?.containerType ?? 'chat'
  if (containerType === 'chat') {
    return {
      containerId: resolveDefaultChatId(env, input?.containerId),
      containerType
    }
  }

  const containerId = input?.containerId
  if (containerId == null || containerId.trim() === '') {
    throw new Error('Missing thread containerId for message history lookup.')
  }
  return {
    containerId,
    containerType
  }
}

export const createLarkMessageHistoryActions = (
  env: LarkMcpRuntimeEnv,
  im: LarkImClient
) => ({
  listMessages: async (input?: {
    containerId?: string
    containerType?: LarkMessageContainerType
    startTime?: string
    endTime?: string
    sortType?: LarkMessageSortType
    pageSize?: number
    pageToken?: string
  }) => {
    const target = resolveContainerTarget(env, input)
    const result = ensureSuccess(
      'List messages',
      await im.message.list({
        params: {
          container_id: target.containerId,
          container_id_type: target.containerType,
          start_time: input?.startTime,
          end_time: input?.endTime,
          sort_type: input?.sortType,
          page_size: input?.pageSize,
          page_token: input?.pageToken
        }
      })
    ) as { data?: unknown }
    return result.data ?? {}
  }
})
