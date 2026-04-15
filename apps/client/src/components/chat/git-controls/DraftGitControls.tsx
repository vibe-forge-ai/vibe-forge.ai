import './ChatGitControls.scss'

import { useTranslation } from 'react-i18next'

import type { ChatSessionWorkspaceDraft } from '#~/hooks/chat/chat-session-workspace-draft'

import { BranchSwitcherDropdown } from './BranchSwitcherDropdown'
import { GitWorktreeDropdown } from './GitWorktreeDropdown'
import { useChatDraftGitControls } from './use-chat-draft-git-controls'

export function DraftGitControls({
  disabled = false,
  draft,
  placement = 'topLeft',
  onChange
}: {
  disabled?: boolean
  draft: ChatSessionWorkspaceDraft
  placement?: 'bottomLeft' | 'topLeft'
  onChange: (nextDraft: ChatSessionWorkspaceDraft) => void
}) {
  const { t } = useTranslation()
  const git = useChatDraftGitControls({
    draft,
    onChange
  })

  return (
    <div className='chat-draft-git'>
      {git.repoState.available
        ? (
          <div className='chat-header-git chat-draft-git__controls'>
            <GitWorktreeDropdown
              currentBranch={git.repoState.currentBranch}
              open={git.worktreeMenuOpen}
              placement={placement}
              mode={{
                type: 'draft',
                createWorktree: draft.createWorktree,
                disabled,
                onCreateWorktreeChange: git.handleCreateWorktreeChange
              }}
              worktrees={git.worktrees}
              onOpenChange={(nextOpen) => {
                git.setWorktreeMenuOpen(nextOpen)
                if (nextOpen) {
                  git.setBranchMenuOpen(false)
                }
              }}
            />

            <BranchSwitcherDropdown
              availableLocalBranches={git.availableLocalBranches}
              branchQuery={git.branchQuery}
              canCreateBranch={git.canCreateBranch}
              currentBranchLabel={git.currentBranchLabel}
              hasBranchResults={git.hasBranchResults}
              isBusy={disabled}
              isLoading={git.isBranchListLoading}
              open={git.branchMenuOpen}
              placement={placement}
              remoteBranches={git.remoteBranches}
              repoState={git.repoState}
              onCreateBranch={git.handleCreateBranch}
              onOpenChange={(nextOpen) => {
                git.setBranchMenuOpen(nextOpen)
                if (nextOpen) {
                  git.setWorktreeMenuOpen(false)
                  git.setShouldLoadBranches(true)
                  return
                }
                git.setBranchQuery('')
              }}
              onQueryChange={git.setBranchQuery}
              onSwitchBranch={git.handleBranchSwitch}
            />
          </div>
        )
        : (
          <div className='chat-draft-git__unavailable'>
            <span className='material-symbols-rounded'>info</span>
            <span>{t('chat.sessionWorkspaceDraftGitUnavailable')}</span>
          </div>
        )}
    </div>
  )
}
