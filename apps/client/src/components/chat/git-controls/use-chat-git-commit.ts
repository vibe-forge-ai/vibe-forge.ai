import { App } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { GitRepositoryState } from '@vibe-forge/types'

import { commitSessionGitChanges, getApiErrorMessage, pushSessionGitBranch } from '#~/api'

import type { GitCommitNextStep } from './git-commit-utils'
import {
  canGitCommitAndPush,
  canSubmitGitCommit,
  getGitCommitBlockedReason,
  getGitCommitSummary,
  isGitCommitMessageRequired
} from './git-commit-utils'
import { getGitPushBlockedReason } from './git-operation-utils'

export function useChatGitCommit({
  closeOperationsMenu,
  refreshGitState,
  repoState,
  sessionId,
  setPendingAction
}: {
  closeOperationsMenu: () => void
  refreshGitState: (nextRepo?: GitRepositoryState) => Promise<void>
  repoState: GitRepositoryState | undefined
  sessionId: string
  setPendingAction: (action: 'commit' | 'commit-and-push' | null) => void
}) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [commitModalOpen, setCommitModalOpen] = useState(false)
  const [commitMessage, setCommitMessage] = useState('')
  const [commitMessageError, setCommitMessageError] = useState('')
  const [commitIncludeUnstagedChanges, setCommitIncludeUnstagedChanges] = useState(true)
  const [commitSkipHooks, setCommitSkipHooks] = useState(false)
  const [commitAmend, setCommitAmend] = useState(false)
  const [commitForcePush, setCommitForcePush] = useState(false)
  const [commitNextStep, setCommitNextStep] = useState<GitCommitNextStep>('commit')

  const resetCommitState = () => {
    setCommitModalOpen(false)
    setCommitMessage('')
    setCommitMessageError('')
    setCommitIncludeUnstagedChanges(true)
    setCommitSkipHooks(false)
    setCommitAmend(false)
    setCommitForcePush(false)
    setCommitNextStep('commit')
  }

  useEffect(() => {
    resetCommitState()
  }, [sessionId])

  const commitSummary = useMemo(() => {
    if (repoState?.available !== true) {
      return null
    }

    return getGitCommitSummary(repoState, commitIncludeUnstagedChanges)
  }, [commitIncludeUnstagedChanges, repoState])

  const canCommitAndPush = repoState?.available === true && canGitCommitAndPush(repoState)
  const baseCommitBlockedReason = repoState?.available === true
    ? getGitCommitBlockedReason(repoState, {
      includeUnstagedChanges: commitIncludeUnstagedChanges,
      amend: commitAmend,
      commitMessage
    })
    : null
  const commitPushBlockedReason = repoState?.available === true && commitNextStep === 'commit-and-push'
    ? getGitPushBlockedReason(repoState, commitForcePush)
    : null
  const canSubmitCommit = repoState?.available === true && canSubmitGitCommit(repoState, {
    includeUnstagedChanges: commitIncludeUnstagedChanges,
    amend: commitAmend,
    commitMessage
  }) && commitPushBlockedReason == null
  const commitBlockedReason = baseCommitBlockedReason ?? commitPushBlockedReason
  const commitBlockedMessage = commitBlockedReason == null
    ? ''
    : commitBlockedReason === 'amend-unavailable'
    ? t('chat.gitAmendUnavailable')
    : commitBlockedReason === 'message-required'
    ? t('chat.gitCommitMessageRequired')
    : commitBlockedReason === 'behind-upstream'
    ? t('chat.gitPushNeedsSyncOrForce')
    : commitIncludeUnstagedChanges
    ? t('chat.gitCommitNoChanges')
    : t('chat.gitCommitNoStagedChanges')

  useEffect(() => {
    if (commitNextStep === 'commit-and-push' && !canCommitAndPush) {
      setCommitNextStep('commit')
    }
  }, [canCommitAndPush, commitNextStep])

  const handleCommit = () => {
    if (repoState?.available !== true) {
      return
    }

    const trimmedMessage = commitMessage.trim()
    if (trimmedMessage === '' && isGitCommitMessageRequired(commitAmend)) {
      setCommitMessageError(t('chat.gitCommitMessageRequired'))
      return
    }

    if (!canSubmitCommit) {
      void message.error(commitBlockedMessage === '' ? t('common.operationFailed') : commitBlockedMessage)
      return
    }

    const action = commitNextStep === 'commit-and-push' ? 'commit-and-push' : 'commit'

    void (async () => {
      setPendingAction(action)
      try {
        const commitResult = await commitSessionGitChanges(sessionId, {
          message: trimmedMessage === '' ? undefined : trimmedMessage,
          includeUnstagedChanges: commitIncludeUnstagedChanges,
          amend: commitAmend,
          skipHooks: commitSkipHooks
        })

        if (commitNextStep === 'commit-and-push') {
          try {
            const pushResult = await pushSessionGitBranch(sessionId, {
              force: commitForcePush
            })
            await refreshGitState(pushResult.repo)
            resetCommitState()
            closeOperationsMenu()
            void message.success(commitAmend ? t('chat.gitAmendAndPushSuccess') : t('chat.gitCommitAndPushSuccess'))
          } catch (error) {
            await refreshGitState()
            resetCommitState()
            closeOperationsMenu()
            void message.error(t('chat.gitCommitPushFailedAfterCommit', {
              error: getApiErrorMessage(error, t('common.operationFailed'))
            }))
          }
          return
        }

        await refreshGitState(commitResult.repo)
        resetCommitState()
        closeOperationsMenu()
        void message.success(commitAmend ? t('chat.gitAmendSuccess') : t('chat.gitCommitSuccess'))
      } catch (error) {
        void message.error(getApiErrorMessage(error, t('common.operationFailed')))
      } finally {
        setPendingAction(null)
      }
    })()
  }

  return {
    canCommitAndPush,
    canSubmitCommit,
    commitAmend,
    commitBlockedMessage,
    commitForcePush,
    commitIncludeUnstagedChanges,
    commitMessage,
    commitMessageError,
    commitModalOpen,
    commitNextStep,
    commitSkipHooks,
    commitSummary,
    handleCommit,
    resetCommitState,
    setCommitAmend,
    setCommitForcePush,
    setCommitIncludeUnstagedChanges,
    setCommitMessage,
    setCommitMessageError,
    setCommitModalOpen,
    setCommitNextStep,
    setCommitSkipHooks
  }
}
