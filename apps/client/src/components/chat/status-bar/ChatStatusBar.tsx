import './ChatStatusBar.scss'

import type { ChatSessionWorkspaceDraft } from '#~/hooks/chat/chat-session-workspace-draft'

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
  return (
    <div className='chat-status-bar'>
      <div className='chat-status-bar__content'>
        {sessionId != null && sessionId !== ''
          ? <ChatGitControls placement='topLeft' sessionId={sessionId} />
          : (
              <DraftGitControls
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
