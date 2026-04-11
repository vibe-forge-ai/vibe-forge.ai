import { z } from 'zod'

import { registerLarkAnnouncementTools } from './register-announcement-tools.js'
import { registerLarkCardTools } from './register-card-tools.js'
import { registerLarkChatManagementTools } from './register-chat-management-tools.js'
import { registerLarkChatTools } from './register-chat-tools.js'
import { registerLarkDirectoryTools } from './register-directory-tools.js'
import { registerLarkMessageAdvancedTools } from './register-message-advanced-tools.js'
import { registerLarkMessageHistoryTools } from './register-message-history-tools.js'
import { registerLarkMessageLifecycleTools } from './register-message-lifecycle-tools.js'
import { registerLarkMessageTools } from './register-message-tools.js'
import { registerLarkPinTools } from './register-pin-tools.js'
import { registerLarkReactionTools } from './register-reaction-tools.js'
import { registerLarkResourceTools } from './register-resource-tools.js'
import type { RegisterServer } from './register-utils.js'
import { toJsonResult } from './register-utils.js'
import { createLarkMcpService } from './service.js'
import type { LarkMcpRuntimeEnv } from './types.js'
import { larkPermissionOperationSchema } from './types.js'

const emptySchema = z.object({})
const permissionGuideSchema = z.object({
  operation: larkPermissionOperationSchema.describe('The Lark operation to inspect')
})

export const registerLarkMcpTools = (
  server: RegisterServer,
  env: LarkMcpRuntimeEnv
) => {
  const service = createLarkMcpService(env)

  server.registerTool(
    'GetChannelContext',
    {
      title: 'Get Channel Context',
      description: 'Return the current Lark channel/session context and default reply target.',
      inputSchema: emptySchema
    },
    async () => toJsonResult(service.getChannelContext())
  )

  server.registerTool(
    'GetPermissionGuide',
    {
      title: 'Get Permission Guide',
      description: 'Explain the Feishu/Lark capability requirements for a common operation.',
      inputSchema: permissionGuideSchema
    },
    async ({ operation }: z.infer<typeof permissionGuideSchema>) => toJsonResult(service.getPermissionGuide(operation))
  )

  registerLarkMessageTools(server, service)
  registerLarkMessageAdvancedTools(server, service)
  registerLarkMessageLifecycleTools(server, service)
  registerLarkCardTools(server, service)
  registerLarkChatTools(server, service)
  registerLarkChatManagementTools(server, service)
  registerLarkAnnouncementTools(server, service)
  registerLarkMessageHistoryTools(server, service)
  registerLarkReactionTools(server, service)
  registerLarkPinTools(server, service)
  registerLarkResourceTools(server, service)
  registerLarkDirectoryTools(server, service)
}
