import { useTranslation } from 'react-i18next'

import type { Session } from '@vibe-forge/core'
import { useChatInteraction } from './useChatInteraction'
import { useChatModels } from './useChatModels'
import { useChatPermissionMode } from './useChatPermissionMode'
import { useChatSessionMessages } from './useChatSessionMessages'
import { useChatView } from './useChatView'

export function useChatSession({
  session
}: {
  session?: Session
}) {
  const { t } = useTranslation()
  const {
    selectedModel,
    selectedModelWithService,
    setSelectedModel,
    modelOptions,
    hasAvailableModels
  } = useChatModels()
  const { permissionMode, setPermissionMode, permissionModeOptions } = useChatPermissionMode()
  const { activeView, setActiveView } = useChatView()
  const { interactionRequest, setInteractionRequest, handleInteractionResponse } = useChatInteraction({
    sessionId: session?.id
  })
  const { messages, setMessages, sessionInfo, isReady } = useChatSessionMessages({
    session,
    modelForQuery: selectedModelWithService,
    permissionMode,
    setInteractionRequest
  })
  const isThinking = session?.status === 'running'

  return {
    messages,
    sessionInfo,
    interactionRequest,
    isReady,
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
    hasAvailableModels,
    modelUnavailable: !hasAvailableModels
  }
}
