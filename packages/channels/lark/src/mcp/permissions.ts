import type { LarkPermissionOperation } from './types.js'

import { chatManagementPermissionGuideByOperation } from './permissions-chat-management.js'
import { chatPermissionGuideByOperation } from './permissions-chat.js'
import { directoryPermissionGuideByOperation } from './permissions-directory.js'
import { messageAdvancedPermissionGuideByOperation } from './permissions-message-advanced.js'
import { messageLifecyclePermissionGuideByOperation } from './permissions-message-lifecycle.js'
import { messagePermissionGuideByOperation } from './permissions-message.js'

export interface LarkPermissionGuide {
  operation: string
  summary: string
  requirements: string[]
  docs: string[]
}

export const permissionGuideByOperation: Record<LarkPermissionOperation, LarkPermissionGuide> = {
  ...messagePermissionGuideByOperation,
  ...messageAdvancedPermissionGuideByOperation,
  ...messageLifecyclePermissionGuideByOperation,
  ...chatPermissionGuideByOperation,
  ...chatManagementPermissionGuideByOperation,
  ...directoryPermissionGuideByOperation
} as Record<LarkPermissionOperation, LarkPermissionGuide>
