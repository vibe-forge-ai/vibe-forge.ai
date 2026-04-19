import { useMemo } from 'react'

import type { GitBranchKind } from '@vibe-forge/types'

import type { ChatEffort } from '#~/hooks/chat/use-chat-effort'
import type { PermissionMode } from '#~/hooks/chat/use-chat-permission-mode'

import type { AutomationBranchAction, AutomationCreateWorktreeMode } from '../types'

export function useAutomationStartupStaticOptions(t: (key: string) => string) {
  const effortOptions = useMemo<Array<{ value: ChatEffort; label: string }>>(() => [
    { value: 'default', label: t('automation.startupDefault') },
    { value: 'low', label: t('automation.effortLow') },
    { value: 'medium', label: t('automation.effortMedium') },
    { value: 'high', label: t('automation.effortHigh') },
    { value: 'max', label: t('automation.effortMax') }
  ], [t])

  const permissionModeOptions = useMemo<Array<{ value: PermissionMode; label: string }>>(() => [
    { value: 'default', label: t('automation.startupDefault') },
    { value: 'acceptEdits', label: t('automation.permissionAcceptEdits') },
    { value: 'plan', label: t('automation.permissionPlan') },
    { value: 'dontAsk', label: t('automation.permissionDontAsk') },
    { value: 'bypassPermissions', label: t('automation.permissionBypassPermissions') }
  ], [t])

  const workspaceModeOptions = useMemo<Array<{ value: AutomationCreateWorktreeMode; label: string }>>(() => [
    { value: 'default', label: t('automation.startupDefault') },
    { value: 'managed', label: t('automation.startupUseManagedWorktree') },
    { value: 'local', label: t('automation.startupUseCurrentWorkspace') }
  ], [t])

  const branchActionOptions = useMemo<Array<{ value: AutomationBranchAction; label: string }>>(() => [
    { value: 'default', label: t('automation.startupBranchDefault') },
    { value: 'checkout', label: t('automation.startupBranchCheckout') },
    { value: 'create', label: t('automation.startupBranchCreate') }
  ], [t])

  const branchKindOptions = useMemo<Array<{ value: GitBranchKind; label: string }>>(() => [
    { value: 'local', label: t('automation.startupBranchKindLocal') },
    { value: 'remote', label: t('automation.startupBranchKindRemote') }
  ], [t])

  return {
    branchActionOptions,
    branchKindOptions,
    effortOptions,
    permissionModeOptions,
    workspaceModeOptions
  }
}
