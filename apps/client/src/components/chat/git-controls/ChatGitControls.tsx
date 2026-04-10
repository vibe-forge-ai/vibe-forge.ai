import './ChatGitControls.scss'

import { useTranslation } from 'react-i18next'

import { syncSessionGitBranch } from '#~/api'

import { BranchSwitcherDropdown } from './BranchSwitcherDropdown'
import { GitCommitModal } from './GitCommitModal'
import { GitOperationsDropdown } from './GitOperationsDropdown'
import { GitPushModal } from './GitPushModal'
import { useChatGitControls } from './use-chat-git-controls'

export function ChatGitControls({
  sessionId
}: {
  sessionId: string
}) {
  const { t } = useTranslation()
  const git = useChatGitControls(sessionId)

  if (git.repoState?.available !== true) {
    return null
  }

  return (
    <>
      <div className='chat-header-git'>
        <GitOperationsDropdown
          isBusy={git.isBusy}
          open={git.operationsMenuOpen}
          repoState={git.repoState}
          onOpenChange={git.setOperationsMenuOpen}
          onOpenCommit={() => {
            git.setOperationsMenuOpen(false)
            git.setCommitMessageError('')
            git.setCommitModalOpen(true)
          }}
          onPush={git.handleOpenPushModal}
          onSync={() => {
            void git.runMutation(
              'sync',
              () => syncSessionGitBranch(sessionId),
              t('chat.gitSyncSuccess'),
              () => git.setOperationsMenuOpen(false)
            )
          }}
        />

        <BranchSwitcherDropdown
          currentBranchLabel={git.currentBranchLabel}
          isBusy={git.isBusy}
          isLoading={git.isBranchListLoading}
          open={git.branchMenuOpen}
          repoState={git.repoState}
          branchQuery={git.branchQuery}
          canCreateBranch={git.canCreateBranch}
          hasBranchResults={git.hasBranchResults}
          localBranches={git.localBranches}
          remoteBranches={git.remoteBranches}
          onCreateBranch={git.handleCreateBranch}
          onOpenChange={(nextOpen) => {
            git.setBranchMenuOpen(nextOpen)
            if (nextOpen) {
              git.setShouldLoadBranches(true)
              return
            }
            git.setBranchQuery('')
          }}
          onQueryChange={git.setBranchQuery}
          onSwitchBranch={git.handleBranchSwitch}
        />

        <div className='chat-header-git__separator' />
      </div>

      <GitCommitModal
        canCommitAndPush={git.canCommitAndPush}
        canSubmit={git.canSubmitCommit}
        commitAmend={git.commitAmend}
        commitBlockedMessage={git.commitBlockedMessage}
        commitForcePush={git.commitForcePush}
        commitIncludeUnstagedChanges={git.commitIncludeUnstagedChanges}
        commitMessage={git.commitMessage}
        commitMessageError={git.commitMessageError}
        commitNextStep={git.commitNextStep}
        commitSkipHooks={git.commitSkipHooks}
        commitSummary={git.commitSummary}
        currentBranchLabel={git.currentBranchLabel}
        headCommit={git.repoState.headCommit ?? null}
        open={git.commitModalOpen}
        pending={git.pendingAction === 'commit' || git.pendingAction === 'commit-and-push'}
        onCancel={git.resetCommitState}
        onCommit={git.handleCommit}
        onNextStepChange={git.setCommitNextStep}
        onToggleAmend={(checked) => {
          git.setCommitAmend(checked)
          if (git.commitMessageError !== '') {
            git.setCommitMessageError('')
          }
        }}
        onToggleForcePush={git.setCommitForcePush}
        onToggleIncludeUnstagedChanges={(checked) => {
          git.setCommitIncludeUnstagedChanges(checked)
        }}
        onToggleSkipHooks={git.setCommitSkipHooks}
        onMessageChange={(value) => {
          git.setCommitMessage(value)
          if (git.commitMessageError !== '') {
            git.setCommitMessageError('')
          }
        }}
      />

      <GitPushModal
        blockedMessage={git.pushBlockedMessage}
        currentBranchLabel={git.currentBranchLabel}
        forcePush={git.pushForce}
        hasUpstream={git.repoState.upstream != null && git.repoState.upstream.trim() !== ''}
        open={git.pushModalOpen}
        pending={git.pendingAction === 'push'}
        upstreamLabel={git.repoState.upstream?.trim() || t('chat.gitNoUpstream')}
        onCancel={git.resetPushState}
        onPush={git.handlePush}
        onToggleForcePush={git.setPushForce}
      />
    </>
  )
}
