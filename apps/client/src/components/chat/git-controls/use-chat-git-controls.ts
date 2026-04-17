/* eslint-disable max-lines */

import { App } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import type { GitBranchListResult, GitBranchSummary, GitRepositoryState, SessionWorkspace } from '@vibe-forge/types'

import {
  checkoutSessionGitBranch,
  createSessionGitBranch,
  createSessionManagedWorktree,
  getApiErrorMessage,
  getSessionGitState,
  getSessionWorkspace,
  listSessionGitBranches,
  transferSessionWorkspaceToLocal
} from '#~/api'

import { filterGitBranches, getGitBranchViewState, hasExactGitBranchMatch } from './git-branch-utils'
import { runGitControlMutation, runSessionGitPush } from './git-mutation-utils'
import { getGitControlState } from './git-operation-utils'
import { useChatGitCommit } from './use-chat-git-commit'
import { useChatGitPushState } from './use-chat-git-push-state'
import { useChatGitWorktrees } from './use-chat-git-worktrees'

type GitActionKind =
  | 'branch-create'
  | 'branch-switch'
  | 'commit'
  | 'commit-and-push'
  | 'push'
  | 'sync'
  | 'workspace-create'
  | 'workspace-transfer'

export function useChatGitControls(sessionId: string) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [branchMenuOpen, setBranchMenuOpen] = useState(false)
  const [operationsMenuOpen, setOperationsMenuOpen] = useState(false)
  const [shouldLoadBranches, setShouldLoadBranches] = useState(false)
  const [branchQuery, setBranchQuery] = useState('')
  const [pendingAction, setPendingAction] = useState<GitActionKind | null>(null)
  const push = useChatGitPushState()

  const { data: workspaceData, mutate: mutateWorkspaceData } = useSWR<{ workspace: SessionWorkspace }>(
    ['session-workspace', sessionId],
    () => getSessionWorkspace(sessionId),
    { revalidateOnFocus: false }
  )
  const { data: repoState, mutate: mutateRepoState } = useSWR<GitRepositoryState>(
    ['session-git-state', sessionId],
    () => getSessionGitState(sessionId),
    { revalidateOnFocus: false }
  )
  const { data: branchData, isLoading: isBranchListLoading, mutate: mutateBranchData } = useSWR<GitBranchListResult>(
    shouldLoadBranches ? ['session-git-branches', sessionId] : null,
    () => listSessionGitBranches(sessionId),
    { revalidateOnFocus: false }
  )
  const worktree = useChatGitWorktrees({
    currentBranch: repoState?.currentBranch,
    enabled: repoState?.available === true,
    repositoryRoot: repoState?.repositoryRoot,
    sessionId
  })

  useEffect(() => {
    setBranchMenuOpen(false)
    setOperationsMenuOpen(false)
    worktree.setWorktreeMenuOpen(false)
    setShouldLoadBranches(false)
    setBranchQuery('')
    setPendingAction(null)
    push.resetPushState()
  }, [sessionId])

  const refreshGitState = async (nextRepo?: GitRepositoryState) => {
    if (nextRepo != null) {
      await mutateRepoState(nextRepo, { revalidate: false })
    } else {
      await mutateRepoState()
    }

    if (shouldLoadBranches) {
      await mutateBranchData()
    }

    if (repoState?.available === true || nextRepo?.available === true) {
      await worktree.mutateWorktreeData()
    }
  }

  const refreshWorkspaceState = async (nextWorkspace?: SessionWorkspace) => {
    if (nextWorkspace != null) {
      await mutateWorkspaceData({ workspace: nextWorkspace }, { revalidate: false })
      return
    }

    await mutateWorkspaceData()
  }

  const commit = useChatGitCommit({
    closeOperationsMenu: () => setOperationsMenuOpen(false),
    refreshGitState,
    repoState,
    sessionId,
    setPendingAction
  })

  const allBranches = branchData?.branches ?? []
  const filteredBranches = useMemo(() => filterGitBranches(allBranches, branchQuery), [allBranches, branchQuery])
  const currentWorktreePath = repoState?.available === true ? repoState.repositoryRoot ?? '' : ''
  const { availableLocalBranches, hasResults: hasBranchResults, remoteBranches } = useMemo(
    () => getGitBranchViewState(filteredBranches, allBranches, currentWorktreePath),
    [allBranches, filteredBranches, currentWorktreePath]
  )
  const canCreateBranch = branchQuery.trim() !== '' && !hasExactGitBranchMatch(allBranches, branchQuery)
  const isBusy = pendingAction != null

  const { currentBranchLabel, pushBlockedMessage, pushBlockedReason } = getGitControlState(repoState, push.pushForce, {
    detachedHead: t('chat.gitDetachedHead'),
    pushNeedsSyncOrForce: t('chat.gitPushNeedsSyncOrForce'),
    pushUnavailable: t('common.operationFailed')
  })

  const runMutation = async (
    action: Exclude<GitActionKind, 'commit' | 'commit-and-push'>,
    task: () => Promise<{ repo: GitRepositoryState }>,
    successMessage: string,
    onSuccess?: () => void
  ) =>
    runGitControlMutation({
      action,
      notifyError: error => void message.error(getApiErrorMessage(error, t('common.operationFailed'))),
      notifySuccess: nextMessage => void message.success(nextMessage),
      onSuccess,
      refreshGitState,
      setPendingAction,
      successMessage,
      task
    })

  const runWorkspaceMutation = async (
    action: Extract<GitActionKind, 'workspace-create' | 'workspace-transfer'>,
    task: () => Promise<{ workspace: SessionWorkspace }>,
    successMessage: string,
    onSuccess?: () => void
  ) => {
    setPendingAction(action)
    try {
      const result = await task()
      await refreshWorkspaceState(result.workspace)
      await refreshGitState()
      onSuccess?.()
      void message.success(successMessage)
    } catch (error) {
      void message.error(getApiErrorMessage(error, t('common.operationFailed')))
    } finally {
      setPendingAction(null)
    }
  }

  const closeBranchMenu = () => {
    setBranchMenuOpen(false)
    setBranchQuery('')
  }

  const handleBranchSwitch = (branch: GitBranchSummary) => {
    void runMutation(
      'branch-switch',
      () => checkoutSessionGitBranch(sessionId, { name: branch.name, kind: branch.kind }),
      t('chat.gitSwitchBranchSuccess', { branch: branch.kind === 'local' ? branch.name : branch.localName }),
      closeBranchMenu
    )
  }

  const handleCreateBranch = (name: string) => {
    const trimmedName = name.trim()
    if (trimmedName === '') {
      return
    }

    void runMutation(
      'branch-create',
      () => createSessionGitBranch(sessionId, { name: trimmedName }),
      t('chat.gitCreateBranchSuccess', { branch: trimmedName }),
      closeBranchMenu
    )
  }

  const handleOpenPushModal = () => {
    setOperationsMenuOpen(false)
    push.setPushModalOpen(true)
  }

  const handlePush = () => {
    void runSessionGitPush({
      blockedMessage: pushBlockedMessage,
      blockedReason: pushBlockedReason,
      force: push.pushForce,
      notifyBlocked: nextMessage => void message.error(nextMessage),
      onSuccess: push.resetPushState,
      repoState,
      runMutation,
      sessionId,
      successMessage: push.pushForce ? t('chat.gitForcePushSuccess') : t('chat.gitPushSuccess')
    })
  }

  const handleCreateManagedWorktree = () => {
    void runWorkspaceMutation(
      'workspace-create',
      () => createSessionManagedWorktree(sessionId),
      t('chat.sessionWorkspaceCreateWorktreeSuccess'),
      () => {
        worktree.setWorktreeMenuOpen(false)
        setBranchMenuOpen(false)
      }
    )
  }

  const handleTransferWorkspaceToLocal = () => {
    void runWorkspaceMutation(
      'workspace-transfer',
      () => transferSessionWorkspaceToLocal(sessionId),
      t('chat.sessionWorkspaceTransferToLocalSuccess'),
      () => {
        worktree.setWorktreeMenuOpen(false)
      }
    )
  }

  return {
    branchMenuOpen,
    branchQuery,
    canCreateBranch,
    currentBranchLabel,
    handleBranchSwitch,
    handleCreateBranch,
    handleCreateManagedWorktree,
    handleOpenPushModal,
    handlePush,
    handleTransferWorkspaceToLocal,
    hasBranchResults,
    isBranchListLoading,
    isBusy,
    availableLocalBranches,
    operationsMenuOpen,
    pendingAction,
    pushBlockedMessage,
    pushForce: push.pushForce,
    pushModalOpen: push.pushModalOpen,
    remoteBranches,
    repoState,
    workspace: workspaceData?.workspace,
    runMutation,
    showWorktreeButton: worktree.showWorktreeButton,
    worktreeMenuOpen: worktree.worktreeMenuOpen,
    worktrees: worktree.worktrees,
    setBranchMenuOpen,
    setBranchQuery,
    setOperationsMenuOpen,
    setPushForce: push.setPushForce,
    setPushModalOpen: push.setPushModalOpen,
    setShouldLoadBranches,
    setWorktreeMenuOpen: worktree.setWorktreeMenuOpen,
    resetPushState: push.resetPushState,
    ...commit
  }
}
