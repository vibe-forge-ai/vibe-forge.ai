import './ChatStatusBar.scss'

import type { ChatSessionWorkspaceDraft } from '#~/hooks/chat/chat-session-workspace-draft'
import { useResponsiveLayout } from '#~/hooks/use-responsive-layout'

import { ChatGitControls } from '../git-controls/ChatGitControls'
import { DraftGitControls } from '../git-controls/DraftGitControls'

export function ChatStatusBar({
  draftWorkspace,
  isCreating,
  sessionId,
  onDraftWorkspaceChange
}: {
  draftWorkspace: ChatSessionWorkspaceDraft
  isCreating: boolean
  sessionId?: string
  onDraftWorkspaceChange: (nextDraft: ChatSessionWorkspaceDraft) => void
}) {
  const { isCompactLayout } = useResponsiveLayout()

  return (
    <div className={`chat-status-bar ${isCompactLayout ? 'chat-status-bar--compact' : ''}`}>
      <div className='chat-status-bar__content'>
        {sessionId != null && sessionId !== ''
          ? <ChatGitControls compact={isCompactLayout} placement='topLeft' sessionId={sessionId} />
          : (
            <DraftGitControls
              compact={isCompactLayout}
              disabled={isCreating}
              draft={draftWorkspace}
              placement='topLeft'
              onChange={onDraftWorkspaceChange}
            />
          )}
      </div>
    </div>
  )
}
