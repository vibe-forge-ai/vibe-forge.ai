import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import type { Session } from '@vibe-forge/core'
import { useChatAdapter } from './use-chat-adapter'
import { useChatInteraction } from './use-chat-interaction'
import { useChatModels } from './use-chat-models'
import { useChatPermissionMode } from './use-chat-permission-mode'
import { useChatSessionMessages } from './use-chat-session-messages'
import { useChatView } from './use-chat-view'

export function useChatSession({
  session
}: {
  session?: Session
}) {
  const { t } = useTranslation()
  const { selectedAdapter, setSelectedAdapter, adapterOptions } = useChatAdapter()
  const {
    selectedModel,
    selectedModelWithService,
    setSelectedModel,
    modelOptions,
    hasAvailableModels
  } = useChatModels({ selectedAdapter })
  const { permissionMode, setPermissionMode, permissionModeOptions } = useChatPermissionMode()
  const { activeView, setActiveView } = useChatView()
  const { interactionRequest, setInteractionRequest, handleInteractionResponse } = useChatInteraction({
    sessionId: session?.id
  })
  const { messages, setMessages, sessionInfo, isReady, connectionError, retryConnection } = useChatSessionMessages({
    session,
    modelForQuery: selectedModelWithService,
    permissionMode,
    adapter: selectedAdapter,
    setInteractionRequest
  })
  const lastObservedSessionRef = useRef<Pick<Session, 'id' | 'model' | 'permissionMode' | 'adapter'> | null>(null)
  const isThinking = session?.status === 'running'

  useEffect(() => {
    if (session?.id == null || session.id === '') {
      lastObservedSessionRef.current = null
      return
    }

    const previous = lastObservedSessionRef.current
    const sessionChanged = previous?.id !== session.id

    if (sessionChanged || previous?.model !== session.model) {
      setSelectedModel(session.model)
    }

    if (sessionChanged || previous?.permissionMode !== session.permissionMode) {
      setPermissionMode(session.permissionMode)
    }

    if (sessionChanged || previous?.adapter !== session.adapter) {
      setSelectedAdapter(session.adapter)
    }

    lastObservedSessionRef.current = {
      id: session.id,
      model: session.model,
      permissionMode: session.permissionMode,
      adapter: session.adapter
    }
  }, [
    session?.adapter,
    session?.id,
    session?.model,
    session?.permissionMode,
    setPermissionMode,
    setSelectedAdapter,
    setSelectedModel
  ])

  return {
    messages,
    sessionInfo,
    interactionRequest,
    isReady,
    connectionError,
    retryConnection,
    isThinking,
    activeView,
    setActiveView,
    handleInteractionResponse,
    setMessages,
    placeholder: !session?.id ? t('chat.newSessionPlaceholder') : undefined,
    modelOptions,
    selectedModel,
    modelForQuery: selectedModelWithService,
    setSelectedModel,
    permissionMode,
    setPermissionMode,
    permissionModeOptions,
    selectedAdapter,
    setSelectedAdapter,
    adapterOptions,
    hasAvailableModels,
    modelUnavailable: !hasAvailableModels
  }
}
