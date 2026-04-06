import { createLarkAnnouncementActions } from './announcement-actions.js'
import { createLarkCardActions } from './card-actions.js'
import { createLarkChatActions } from './chat-actions.js'
import { createLarkChatManagementActions } from './chat-management-actions.js'
import { createLarkDirectoryActions } from './directory-actions.js'
import { createLarkMessageHistoryActions } from './message-history-actions.js'
import { createLarkMessageLifecycleActions } from './message-lifecycle-actions.js'
import { createLarkMessageActions } from './message-actions.js'
import { createLarkMessageAdvancedActions } from './message-advanced-actions.js'
import { createLarkPinActions } from './pin-actions.js'
import { permissionGuideByOperation } from './permissions.js'
import { createLarkReactionActions } from './reaction-actions.js'
import { createLarkResourceActions } from './resource-actions.js'
import { createLarkClient } from './shared.js'
import type { LarkMcpRuntimeEnv, LarkPermissionOperation } from './types.js'

export const createLarkMcpService = (env: LarkMcpRuntimeEnv) => {
  const client = createLarkClient(env)
  const im = client.im
  const contact = client.contact

  return {
    getChannelContext: () => ({
      sessionId: env.sessionId,
      channelKey: env.channelKey,
      channelType: env.channelType,
      channelId: env.channelId,
      sessionType: env.sessionType,
      defaultReceiveId: env.defaultReceiveId ?? env.channelId,
      defaultReceiveIdType: env.defaultReceiveIdType ?? 'chat_id'
    }),
    getPermissionGuide: (operation: LarkPermissionOperation) => permissionGuideByOperation[operation],
    ...createLarkMessageActions(env, im),
    ...createLarkMessageAdvancedActions(env, im),
    ...createLarkMessageLifecycleActions(env, im),
    ...createLarkCardActions(env, im),
    ...createLarkChatActions(env, im),
    ...createLarkChatManagementActions(env, im),
    ...createLarkAnnouncementActions(env, im),
    ...createLarkMessageHistoryActions(env, im),
    ...createLarkReactionActions(env, im),
    ...createLarkPinActions(env, im),
    ...createLarkResourceActions(env, im),
    ...createLarkDirectoryActions(env, contact)
  }
}
