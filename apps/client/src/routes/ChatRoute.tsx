import './ChatRoute.scss'

import { Button, Empty } from 'antd'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import useSWR from 'swr'

import type { Session } from '@vibe-forge/core'

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
    modelMenuGroups,
    modelSearchOptions,
    recommendedModelOptions,
    servicePreviewModelOptions,
    toggleRecommendedModel,
    updatingRecommendedModelValue,
    selectedModel,
    modelForQuery,
    setSelectedModel,
    effort,
    setEffort,
    effortOptions,
    permissionMode,
    setPermissionMode,
    permissionModeOptions,
    selectedAdapter,
    setSelectedAdapter,
    adapterOptions,
    hasAvailableModels,
    modelUnavailable
  } = useChatSession({ session })
  const isEmptyNewSession = !session?.id && messages.length === 0

  return (
    <div className={`chat-container ${isReady ? 'ready' : ''} ${isEmptyNewSession ? 'is-new-session' : ''}`}>
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
          setMessages={setMessages}
          onClearMessages={() => setMessages([])}
          placeholder={placeholder}
          modelMenuGroups={modelMenuGroups}
          modelSearchOptions={modelSearchOptions}
          recommendedModelOptions={recommendedModelOptions}
          servicePreviewModelOptions={servicePreviewModelOptions}
          onToggleRecommendedModel={toggleRecommendedModel}
          updatingRecommendedModelValue={updatingRecommendedModelValue}
          selectedModel={selectedModel}
          modelForQuery={modelForQuery}
          onModelChange={setSelectedModel}
          effort={effort}
          effortOptions={effortOptions}
          onEffortChange={setEffort}
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
          sessionInfo={sessionInfo}
          onClose={() => setActiveView('history')}
        />
      )}
    </div>
  )
}
