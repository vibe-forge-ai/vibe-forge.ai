import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import type { Session } from '@vibe-forge/core'
import { useChatEffort } from './use-chat-effort'
import { useChatInteraction } from './use-chat-interaction'
import { useChatModelAdapterSelection } from './use-chat-model-adapter-selection'
import { useChatPermissionMode } from './use-chat-permission-mode'
import { useChatSessionMessages } from './use-chat-session-messages'
import { useChatView } from './use-chat-view'

export function useChatSession({
  session
}: {
  session?: Session
}) {
  const { t } = useTranslation()
  const {
    adapterOptions,
    applySessionSelection,
    modelMenuGroups,
    selectedAdapter,
    selectedModel,
    selectedModelWithService,
    setSelectedModel,
    setSelectedAdapter,
    modelSearchOptions,
    recommendedModelOptions,
    servicePreviewModelOptions,
    toggleRecommendedModel,
    updatingRecommendedModelValue,
    hasAvailableModels
  } = useChatModelAdapterSelection({
    adapterLocked: session?.id != null
  })
  const { permissionMode, setPermissionMode, permissionModeOptions } = useChatPermissionMode()
  const { effort, setEffort, effortOptions } = useChatEffort()
  const { activeView, isTerminalOpen, setActiveView, setIsTerminalOpen } = useChatView()
  const { interactionRequest, setInteractionRequest, handleInteractionResponse: submitInteractionResponse } =
    useChatInteraction({
      sessionId: session?.id
    })
  const {
    messages,
    setMessages,
    sessionInfo,
    queuedMessages,
    isReady,
    errorState,
    retryConnection,
    reconcileAfterInteraction
  } = useChatSessionMessages({
    session,
    modelForQuery: selectedModelWithService,
    effort,
    permissionMode,
    adapter: selectedAdapter,
    setInteractionRequest
  })
  const handleInteractionResponse = useCallback((id: string, data: string | string[]) => {
    reconcileAfterInteraction()
    submitInteractionResponse(id, data)
  }, [reconcileAfterInteraction, submitInteractionResponse])
  const lastObservedSessionRef = useRef<Pick<Session, 'id' | 'model' | 'permissionMode' | 'adapter' | 'effort'> | null>(
    null
  )
  const isThinking = session?.status === 'running'

  useEffect(() => {
    if (session?.id == null || session.id === '') {
      lastObservedSessionRef.current = null
      return
    }

    const previous = lastObservedSessionRef.current
    const sessionChanged = previous?.id !== session.id

    if (sessionChanged || previous?.model !== session.model || previous?.adapter !== session.adapter) {
      applySessionSelection({
        model: session.model,
        adapter: session.adapter
      })
    }

    if (sessionChanged || previous?.permissionMode !== session.permissionMode) {
      setPermissionMode(session.permissionMode)
    }

    if (sessionChanged || previous?.effort !== session.effort) {
      setEffort(session.effort)
    }

    lastObservedSessionRef.current = {
      id: session.id,
      model: session.model,
      permissionMode: session.permissionMode,
      adapter: session.adapter,
      effort: session.effort
    }
  }, [
    session?.adapter,
    session?.effort,
    session?.id,
    session?.model,
    session?.permissionMode,
    applySessionSelection,
    setEffort,
    setPermissionMode
  ])

  return {
    messages,
    sessionInfo,
    queuedMessages,
    interactionRequest,
    isReady,
    errorState,
    retryConnection,
    isThinking,
    activeView,
    isTerminalOpen,
    setActiveView,
    setIsTerminalOpen,
    handleInteractionResponse,
    setMessages,
    placeholder: !session?.id ? t('chat.newSessionPlaceholder') : undefined,
    modelMenuGroups,
    modelSearchOptions,
    recommendedModelOptions,
    servicePreviewModelOptions,
    toggleRecommendedModel,
    updatingRecommendedModelValue,
    selectedModel,
    modelForQuery: selectedModelWithService,
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
    modelUnavailable: !hasAvailableModels
  }
}
