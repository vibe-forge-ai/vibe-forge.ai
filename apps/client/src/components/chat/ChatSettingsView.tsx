import type { Session } from '@vibe-forge/core'
import type { SessionInfo } from '@vibe-forge/types'

import { SessionSettingsPanel } from './ChatHeader'

export function ChatSettingsView({
  session,
  sessionInfo,
  onClose
}: {
  session: Session
  sessionInfo: SessionInfo | null
  onClose: () => void
}) {
  return (
    <div className='chat-settings-panel'>
      <SessionSettingsPanel
        sessionId={session.id}
        initialTitle={session.title}
        initialTags={session.tags}
        sessionInfo={sessionInfo}
        onClose={onClose}
      />
    </div>
  )
}
