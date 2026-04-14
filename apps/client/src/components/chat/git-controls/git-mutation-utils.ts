import type { GitRepositoryState } from '@vibe-forge/types'

import { pushSessionGitBranch } from '#~/api'

export const runGitControlMutation = async <TAction extends string>(options: {
  action: TAction
  notifyError: (error: unknown) => void
  notifySuccess: (message: string) => void
  onSuccess?: () => void
  refreshGitState: (nextRepo?: GitRepositoryState) => Promise<void>
  setPendingAction: (action: TAction | null) => void
  successMessage: string
  task: () => Promise<{ repo: GitRepositoryState }>
}) => {
  const {
    action,
    notifyError,
    notifySuccess,
    onSuccess,
    refreshGitState,
    setPendingAction,
    successMessage,
    task
  } = options

  setPendingAction(action)
  try {
    const result = await task()
    await refreshGitState(result.repo)
    onSuccess?.()
    notifySuccess(successMessage)
  } catch (error) {
    notifyError(error)
  } finally {
    setPendingAction(null)
  }
}

export const runSessionGitPush = async (options: {
  blockedMessage: string
  blockedReason: string | null
  force: boolean
  notifyBlocked: (message: string) => void
  onSuccess?: () => void
  repoState: GitRepositoryState | undefined
  runMutation: (
    action: 'push',
    task: () => Promise<{ repo: GitRepositoryState }>,
    successMessage: string,
    onSuccess?: () => void
  ) => Promise<void>
  sessionId: string
  successMessage: string
}) => {
  if (options.repoState?.available !== true) {
    return
  }
  if (options.blockedReason != null) {
    options.notifyBlocked(options.blockedMessage)
    return
  }

  await options.runMutation(
    'push',
    () => pushSessionGitBranch(options.sessionId, { force: options.force }),
    options.successMessage,
    options.onSuccess
  )
}
