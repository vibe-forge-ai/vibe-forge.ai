import './ChatRoute.scss'

import { Button, Empty } from 'antd'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import useSWR from 'swr'

import type { ChatMessage, ChatMessageContent, Session } from '@vibe-forge/core'

import { listSessions } from '#~/api'
import { ChatHeader } from '#~/components/chat/ChatHeader.js'
import { ChatHistoryView } from '#~/components/chat/ChatHistoryView.js'
import { ChatSettingsView } from '#~/components/chat/ChatSettingsView.js'
import { ChatTimelineView } from '#~/components/chat/ChatTimelineView.js'
import { useChatSession } from '#~/hooks/chat/use-chat-session'

export function ChatRoute() {
  const { t } = useTranslation()
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { data: sessionsRes, isLoading } = useSWR<{ sessions: Session[] }>(
    sessionId ? '/api/sessions' : null,
    () => listSessions('active')
  )
  const session = sessionId == null ? undefined : sessionsRes?.sessions.find(item => item.id === sessionId)

  if (sessionId != null && isLoading) {
    return null
  }

  if (sessionId != null && session == null) {
    return (
      <div className='chat-route__empty-state'>
        <Empty description={t('common.sessionNotFound')} />
        <Button type='primary' onClick={() => void navigate('/')}>{t('common.backToHome')}</Button>
      </div>
    )
  }

  return <ChatRouteView session={session} />
}

function ChatRouteView({
  session
}: {
  session?: Session
}) {
  const {
    messages,
    sessionInfo,
    interactionRequest,
    isReady,
    connectionError,
    retryConnection,
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
    selectedAdapter,
    setSelectedAdapter,
    adapterOptions,
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
          sessionId={session.id}
          sessionTitle={session.title}
          isStarred={session.isStarred}
          isArchived={session.isArchived}
          tags={session.tags}
          lastMessage={session.lastMessage}
          lastUserMessage={session.lastUserMessage}
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
          connectionError={connectionError}
          onRetryConnection={retryConnection}
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
          selectedAdapter={selectedAdapter}
          adapterOptions={adapterOptions}
          onAdapterChange={setSelectedAdapter}
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
