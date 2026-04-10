import { App } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import type { GitBranchListResult, GitBranchSummary, GitRepositoryState } from '@vibe-forge/types'

import {
  checkoutSessionGitBranch,
  commitSessionGitChanges,
  createSessionGitBranch,
  getApiErrorMessage,
  getSessionGitState,
  listSessionGitBranches
} from '#~/api'

import { filterGitBranches, hasExactGitBranchMatch } from './git-branch-utils'

type GitActionKind = 'branch-create' | 'branch-switch' | 'commit' | 'push' | 'sync'

export function useChatGitControls(sessionId: string) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [branchMenuOpen, setBranchMenuOpen] = useState(false)
  const [operationsMenuOpen, setOperationsMenuOpen] = useState(false)
  const [shouldLoadBranches, setShouldLoadBranches] = useState(false)
  const [branchQuery, setBranchQuery] = useState('')
  const [pendingAction, setPendingAction] = useState<GitActionKind | null>(null)
  const [commitModalOpen, setCommitModalOpen] = useState(false)
  const [commitMessage, setCommitMessage] = useState('')
  const [commitMessageError, setCommitMessageError] = useState('')

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
    setCommitModalOpen(false)
    setCommitMessage('')
    setCommitMessageError('')
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

  const runMutation = async (
    action: GitActionKind,
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

  const handleCommit = () => {
    const trimmedMessage = commitMessage.trim()
    if (trimmedMessage === '') {
      setCommitMessageError(t('chat.gitCommitMessageRequired'))
      return
    }

    void runMutation(
      'commit',
      () => commitSessionGitChanges(sessionId, { message: trimmedMessage }),
      t('chat.gitCommitSuccess'),
      () => {
        setCommitModalOpen(false)
        setCommitMessage('')
        setCommitMessageError('')
        setOperationsMenuOpen(false)
      }
    )
  }

  return {
    branchMenuOpen,
    operationsMenuOpen,
    branchQuery,
    canCreateBranch,
    commitMessage,
    commitMessageError,
    commitModalOpen,
    currentBranchLabel,
    hasBranchResults,
    isBranchListLoading,
    isBusy,
    localBranches,
    pendingAction,
    remoteBranches,
    repoState,
    runMutation,
    setBranchMenuOpen,
    setBranchQuery,
    setCommitMessage,
    setCommitMessageError,
    setCommitModalOpen,
    setOperationsMenuOpen,
    setShouldLoadBranches,
    handleBranchSwitch,
    handleCommit,
    handleCreateBranch
  }
}
