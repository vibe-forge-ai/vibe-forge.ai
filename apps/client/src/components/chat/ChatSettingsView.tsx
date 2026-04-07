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
        session={session}
        sessionInfo={sessionInfo}
        onClose={onClose}
      />
    </div>
  )
}
