import './Chat.scss'

import type { ChatMessage, ChatMessageContent, Session } from '@vibe-forge/core'
import { ChatHeader } from './chat/ChatHeader.js'
import { ChatHistoryView } from './chat/ChatHistoryView.js'
import { ChatSettingsView } from './chat/ChatSettingsView.js'
import { ChatTimelineView } from './chat/ChatTimelineView.js'
import { useChatSession } from '#~/hooks/chat/use-chat-session'

export function Chat({
  session
}: {
  session?: Session
}) {
  const {
    messages,
    sessionInfo,
    interactionRequest,
    isReady,
    activeView,
    setActiveView,
    handleInteractionResponse,
    setMessages,
    placeholder,
    modelOptions,
    selectedModel,
    modelForQuery,
    setSelectedModel,
    permissionMode,
    setPermissionMode,
    permissionModeOptions,
    hasAvailableModels,
    modelUnavailable
  } = useChatSession({ session })
  const buildUserMessage = (content: string | ChatMessageContent[]): ChatMessage => {
    const id = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
    return {
      id,
      role: 'user' as const,
      content,
      createdAt: Date.now()
    }
  }

  return (
    <div className={`chat-container ${isReady ? 'ready' : ''} ${!session?.id ? 'is-new-session' : ''}`}>
      {session?.id && (
        <ChatHeader
          sessionInfo={sessionInfo}
          sessionId={session?.id}
          sessionTitle={session?.title}
          isStarred={session?.isStarred}
          isArchived={session?.isArchived}
          tags={session?.tags}
          lastMessage={session?.lastMessage}
          lastUserMessage={session?.lastUserMessage}
          activeView={activeView}
          onViewChange={setActiveView}
        />
      )}

      {activeView === 'history' && (
        <ChatHistoryView
          isReady={isReady}
          messages={messages}
          session={session}
          sessionInfo={sessionInfo}
          interactionRequest={interactionRequest}
          onInteractionResponse={handleInteractionResponse}
          onClearMessages={() => setMessages([])}
          onSend={(text) => setMessages((prev) => [...prev, buildUserMessage(text)])}
          onSendContent={(content) => setMessages((prev) => [...prev, buildUserMessage(content)])}
          placeholder={placeholder}
          modelOptions={modelOptions}
          selectedModel={selectedModel}
          modelForQuery={modelForQuery}
          onModelChange={setSelectedModel}
          permissionMode={permissionMode}
          permissionModeOptions={permissionModeOptions}
          onPermissionModeChange={setPermissionMode}
          modelUnavailable={modelUnavailable}
          hasAvailableModels={hasAvailableModels}
        />
      )}

      {activeView === 'timeline' && (
        <ChatTimelineView messages={messages} />
      )}

      {activeView === 'settings' && session?.id && (
        <ChatSettingsView
          session={session}
          onClose={() => setActiveView('history')}
        />
      )}
    </div>
  )
}
