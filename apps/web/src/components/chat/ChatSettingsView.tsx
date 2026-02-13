import type { Session } from '@vibe-forge/core'
import { SessionSettingsPanel } from './ChatHeader'

export function ChatSettingsView({
  session,
  onClose
}: {
  session: Session
  onClose: () => void
}) {
  return (
    <div className='chat-settings-panel'>
      <SessionSettingsPanel
        sessionId={session.id}
        initialTitle={session.title}
        initialTags={session.tags}
        isStarred={session.isStarred}
        isArchived={session.isArchived}
        onClose={onClose}
      />
    </div>
  )
}
