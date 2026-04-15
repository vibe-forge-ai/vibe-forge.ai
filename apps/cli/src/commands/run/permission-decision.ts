import type { PermissionInteractionDecision } from '@vibe-forge/types'

import { PERMISSION_DECISION_CANCEL } from './permission-recovery'

export const shouldApplyPermissionDecision = (
  decision: PermissionInteractionDecision | typeof PERMISSION_DECISION_CANCEL
) => decision !== PERMISSION_DECISION_CANCEL && decision !== 'deny_once'

export const shouldClearPermissionRecoveryCache = (
  decision: PermissionInteractionDecision | typeof PERMISSION_DECISION_CANCEL
) => decision !== PERMISSION_DECISION_CANCEL

export const isTerminalPermissionDecision = (
  decision: PermissionInteractionDecision | typeof PERMISSION_DECISION_CANCEL
) => (
  decision === 'deny_once' ||
  decision === 'deny_session' ||
  decision === 'deny_project'
)
