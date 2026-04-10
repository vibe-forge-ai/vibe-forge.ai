import './ChatGitControls.scss'

import { useTranslation } from 'react-i18next'

import { pushSessionGitBranch, syncSessionGitBranch } from '#~/api'

import { BranchSwitcherDropdown } from './BranchSwitcherDropdown'
import { GitCommitModal } from './GitCommitModal'
import { GitOperationsDropdown } from './GitOperationsDropdown'
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
            git.setCommitModalOpen(true)
          }}
          onPush={() => {
            void git.runMutation(
              'push',
              () => pushSessionGitBranch(sessionId),
              t('chat.gitPushSuccess'),
              () => git.setOperationsMenuOpen(false)
            )
          }}
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
        commitMessage={git.commitMessage}
        commitMessageError={git.commitMessageError}
        open={git.commitModalOpen}
        pending={git.pendingAction === 'commit'}
        onCancel={() => {
          git.setCommitModalOpen(false)
          git.setCommitMessageError('')
        }}
        onCommit={git.handleCommit}
        onMessageChange={(value) => {
          git.setCommitMessage(value)
          if (git.commitMessageError !== '') {
            git.setCommitMessageError('')
          }
        }}
      />
    </>
  )
}
