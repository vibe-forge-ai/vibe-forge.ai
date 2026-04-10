import { App } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import type { GitBranchListResult, GitBranchSummary, GitRepositoryState } from '@vibe-forge/types'

import {
  checkoutSessionGitBranch,
  createSessionGitBranch,
  getApiErrorMessage,
  getSessionGitState,
  listSessionGitBranches,
  pushSessionGitBranch
} from '#~/api'

import { filterGitBranches, hasExactGitBranchMatch } from './git-branch-utils'
import { getGitPushBlockedReason } from './git-operation-utils'
import { useChatGitCommit } from './use-chat-git-commit'

type GitActionKind = 'branch-create' | 'branch-switch' | 'commit' | 'commit-and-push' | 'push' | 'sync'

export function useChatGitControls(sessionId: string) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [branchMenuOpen, setBranchMenuOpen] = useState(false)
  const [operationsMenuOpen, setOperationsMenuOpen] = useState(false)
  const [shouldLoadBranches, setShouldLoadBranches] = useState(false)
  const [branchQuery, setBranchQuery] = useState('')
  const [pendingAction, setPendingAction] = useState<GitActionKind | null>(null)
  const [pushModalOpen, setPushModalOpen] = useState(false)
  const [pushForce, setPushForce] = useState(false)

  const resetPushState = () => {
    setPushModalOpen(false)
    setPushForce(false)
  }

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

  useEffect(() => {
    setBranchMenuOpen(false)
    setOperationsMenuOpen(false)
    setShouldLoadBranches(false)
    setBranchQuery('')
    setPendingAction(null)
    resetPushState()
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
  const localBranches = filteredBranches.filter(branch => branch.kind === 'local')
  const remoteBranches = filteredBranches.filter(branch => branch.kind === 'remote')
  const canCreateBranch = branchQuery.trim() !== '' && !hasExactGitBranchMatch(allBranches, branchQuery)
  const hasBranchResults = filteredBranches.length > 0
  const isBusy = pendingAction != null

  const currentBranchLabel = repoState?.available === true && repoState.currentBranch?.trim() !== ''
    ? repoState.currentBranch
    : t('chat.gitDetachedHead')
  const pushBlockedReason = repoState?.available === true
    ? getGitPushBlockedReason(repoState, pushForce)
    : 'push-unavailable'
  const pushBlockedMessage = pushBlockedReason == null
    ? ''
    : pushBlockedReason === 'behind-upstream'
    ? t('chat.gitPushNeedsSyncOrForce')
    : t('common.operationFailed')

  const runMutation = async (
    action: Exclude<GitActionKind, 'commit' | 'commit-and-push'>,
    task: () => Promise<{ repo: GitRepositoryState }>,
    successMessage: string,
    onSuccess?: () => void
  ) => {
    setPendingAction(action)
    try {
      const result = await task()
      await refreshGitState(result.repo)
      onSuccess?.()
      void message.success(successMessage)
    } catch (error) {
      void message.error(getApiErrorMessage(error, t('common.operationFailed')))
    } finally {
      setPendingAction(null)
    }
  }

  const handleBranchSwitch = (branch: GitBranchSummary) => {
    void runMutation(
      'branch-switch',
      () => checkoutSessionGitBranch(sessionId, { name: branch.name, kind: branch.kind }),
      t('chat.gitSwitchBranchSuccess', { branch: branch.kind === 'local' ? branch.name : branch.localName }),
      () => {
        setBranchMenuOpen(false)
        setBranchQuery('')
      }
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
      () => {
        setBranchMenuOpen(false)
        setBranchQuery('')
      }
    )
  }

  const handleOpenPushModal = () => {
    setOperationsMenuOpen(false)
    setPushModalOpen(true)
  }

  const handlePush = () => {
    if (repoState?.available !== true) {
      return
    }
    if (pushBlockedReason != null) {
      void message.error(pushBlockedMessage)
      return
    }

    void runMutation(
      'push',
      () => pushSessionGitBranch(sessionId, { force: pushForce }),
      pushForce ? t('chat.gitForcePushSuccess') : t('chat.gitPushSuccess'),
      resetPushState
    )
  }

  return {
    branchMenuOpen,
    branchQuery,
    canCreateBranch,
    currentBranchLabel,
    handleBranchSwitch,
    handleCreateBranch,
    handleOpenPushModal,
    handlePush,
    hasBranchResults,
    isBranchListLoading,
    isBusy,
    localBranches,
    operationsMenuOpen,
    pendingAction,
    pushBlockedMessage,
    pushForce,
    pushModalOpen,
    remoteBranches,
    repoState,
    runMutation,
    setBranchMenuOpen,
    setBranchQuery,
    setOperationsMenuOpen,
    setPushForce,
    setPushModalOpen,
    setShouldLoadBranches,
    resetPushState,
    ...commit
  }
}
