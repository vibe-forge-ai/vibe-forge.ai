import type { ChatMessage } from '@vibe-forge/core'
import { SessionTimelinePanel } from './SessionTimelinePanel'

export function ChatTimelineView({
  messages,
  isThinking
}: {
  messages: ChatMessage[]
  isThinking: boolean
}) {
  return (
    <SessionTimelinePanel messages={messages} isThinking={isThinking} />
  )
}
