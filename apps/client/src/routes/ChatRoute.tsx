import './ChatRoute.scss'

import { Button, Empty } from 'antd'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import useSWR from 'swr'

import type { Session } from '@vibe-forge/core'

import { listSessions } from '#~/api'
import { ChatHeader } from '#~/components/chat/ChatHeader.js'
import { ChatHistoryView } from '#~/components/chat/ChatHistoryView.js'
import { ChatSettingsView } from '#~/components/chat/ChatSettingsView.js'
import { ChatTimelineView } from '#~/components/chat/ChatTimelineView.js'
import { ChatTerminalView } from '#~/components/chat/terminal/ChatTerminalView.js'
import { useChatSession } from '#~/hooks/chat/use-chat-session'
import { useTerminalDockVisibility } from '#~/hooks/chat/use-terminal-dock-visibility'

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
  const [searchParams] = useSearchParams()
  const {
    messages,
    sessionInfo,
    interactionRequest,
    isReady,
    errorBanner,
    retryConnection,
    activeView,
    isTerminalOpen,
    setActiveView,
    setIsTerminalOpen,
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
  const targetMessageId = searchParams.get('messageId') ?? undefined
  const targetToolUseId = searchParams.get('toolUseId') ?? undefined
  const deepLinkTargetKey = targetToolUseId?.trim()
    ? `tool:${targetToolUseId.trim()}`
    : targetMessageId?.trim()
      ? `message:${targetMessageId.trim()}`
      : ''
  const isEmptyNewSession = !session?.id && messages.length === 0
  const resolvedActiveView = session?.id != null ? activeView : 'history'
  const shouldShowTerminal = session?.id != null && isTerminalOpen
  const { isRendered: isTerminalRendered, isVisible: isTerminalVisible } = useTerminalDockVisibility(shouldShowTerminal)
  const handledDeepLinkTargetRef = useRef('')

  useEffect(() => {
    if (deepLinkTargetKey === '') {
      handledDeepLinkTargetRef.current = ''
      return
    }

    if (handledDeepLinkTargetRef.current === deepLinkTargetKey) {
      return
    }

    handledDeepLinkTargetRef.current = deepLinkTargetKey
    if (activeView !== 'history') {
      setActiveView('history')
    }
  }, [activeView, deepLinkTargetKey, setActiveView])

  return (
    <div
      className={`chat-container ${isReady ? 'ready' : ''} ${isEmptyNewSession ? 'is-new-session' : ''} ${
        shouldShowTerminal ? 'has-terminal' : ''
      }`}
    >
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
          activeView={resolvedActiveView}
          isTerminalOpen={isTerminalOpen}
          onViewChange={setActiveView}
          onToggleTerminal={() => {
            setIsTerminalOpen(!isTerminalOpen)
          }}
        />
      )}

      {resolvedActiveView === 'history' && (
        <ChatHistoryView
          isReady={isReady}
          messages={messages}
          session={session}
          targetMessageId={targetMessageId}
          targetToolUseId={targetToolUseId}
          sessionInfo={sessionInfo}
          errorBanner={errorBanner}
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

      {resolvedActiveView === 'timeline' && (
        <ChatTimelineView messages={messages} />
      )}

      {resolvedActiveView === 'settings' && session?.id && (
        <ChatSettingsView
          session={session}
          sessionInfo={sessionInfo}
          onClose={() => setActiveView('history')}
        />
      )}

      {isTerminalRendered && session?.id && (
        <ChatTerminalView
          isOpen={isTerminalVisible}
          sessionId={session.id}
          onClose={() => setIsTerminalOpen(false)}
        />
      )}
    </div>
  )
}
