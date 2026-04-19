import './ChatStatusBar.scss'

import type { ReactNode } from 'react'

import type { ChatAdapterAccountOption } from '#~/hooks/chat/use-chat-adapter-account-selection'
import { AccountSelectControl } from '#~/components/chat/sender/@components/account-select/AccountSelectControl'
import { AdapterSelectControl } from '#~/components/chat/sender/@components/adapter-select/AdapterSelectControl'
import type { ChatSessionWorkspaceDraft } from '#~/hooks/chat/chat-session-workspace-draft'
import { useResponsiveLayout } from '#~/hooks/use-responsive-layout'

import { ChatGitControls } from '../git-controls/ChatGitControls'
import { DraftGitControls } from '../git-controls/DraftGitControls'

export function ChatStatusBar({
  draftWorkspace,
  isCreating,
  sessionId,
  adapterLocked = false,
  isThinking = false,
  modelUnavailable = false,
  selectedAdapter,
  adapterOptions,
  onAdapterChange,
  selectedAccount,
  accountOptions,
  showAccountSelector = false,
  onAccountChange,
  onDraftWorkspaceChange
}: {
  draftWorkspace: ChatSessionWorkspaceDraft
  isCreating: boolean
  sessionId?: string
  adapterLocked?: boolean
  isThinking?: boolean
  modelUnavailable?: boolean
  selectedAdapter?: string
  adapterOptions?: Array<{ value: string; label: ReactNode }>
  onAdapterChange?: (adapter: string) => void
  selectedAccount?: string
  accountOptions?: ChatAdapterAccountOption[]
  showAccountSelector?: boolean
  onAccountChange?: (account: string) => void
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
      <div className='chat-status-bar__actions'>
        <AccountSelectControl
          state={{
            isThinking,
            modelUnavailable,
            selectedAccount,
            selectedAdapter,
            showAccountSelector
          }}
          data={{ accountOptions }}
          handlers={{ onAccountChange }}
        />
        <AdapterSelectControl
          state={{
            adapterLocked,
            modelUnavailable,
            isThinking,
            selectedAdapter
          }}
          data={{ adapterOptions }}
          handlers={{ onAdapterChange }}
        />
      </div>
    </div>
  )
}
