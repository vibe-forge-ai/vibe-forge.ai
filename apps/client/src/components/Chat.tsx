import './Chat.scss'

import { useTranslation } from 'react-i18next'

import type { Session } from '@vibe-forge/core'
import { ChatHeader } from './chat/ChatHeader.js'
import { ChatHistoryView } from './chat/ChatHistoryView.js'
import { ChatSettingsView } from './chat/ChatSettingsView.js'
import { ChatTimelineView } from './chat/ChatTimelineView.js'
import { useChatModels } from './chat/useChatModels.js'
import { useChatSession } from './chat/useChatSession.js'

export function Chat({
  session
}: {
  session?: Session
}) {
  const { t } = useTranslation()
  const { selectedModel, setSelectedModel, modelOptions, hasAvailableModels } = useChatModels()
  const {
    messages,
    sessionInfo,
    interactionRequest,
    isCreating,
    isReady,
    isThinking,
    activeView,
    setActiveView,
    messagesEndRef,
    messagesContainerRef,
    showScrollBottom,
    scrollToBottom,
    send,
    interrupt,
    clearMessages,
    handleInteractionResponse
  } = useChatSession({ session, selectedModel, hasAvailableModels })

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
          isCreating={isCreating}
          showScrollBottom={showScrollBottom}
          messagesContainerRef={messagesContainerRef}
          messagesEndRef={messagesEndRef}
          scrollToBottom={scrollToBottom}
          interactionRequest={interactionRequest}
          onInteractionResponse={handleInteractionResponse}
          onSend={send}
          onInterrupt={interrupt}
          onClear={clearMessages}
          placeholder={!session?.id ? t('chat.newSessionPlaceholder') : undefined}
          modelOptions={modelOptions}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          modelUnavailable={!hasAvailableModels}
        />
      )}

      {activeView === 'timeline' && (
        <ChatTimelineView messages={messages} isThinking={isThinking} />
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
