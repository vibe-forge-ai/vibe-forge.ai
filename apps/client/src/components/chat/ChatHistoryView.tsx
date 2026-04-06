import { App } from 'antd'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'

import type { ChatErrorBannerState } from '#~/hooks/chat/interaction-state'
import type { ChatEffort } from '#~/hooks/chat/use-chat-effort'
import type { ModelSelectMenuGroup, ModelSelectOption } from '#~/hooks/chat/use-chat-model-adapter-selection'
import type { PermissionMode } from '#~/hooks/chat/use-chat-permission-mode'
import { useChatScroll } from '#~/hooks/chat/use-chat-scroll'
import { useChatSessionActions } from '#~/hooks/chat/use-chat-session-actions'
import type { AskUserQuestionParams, ChatMessage, ChatMessageContent, Session } from '@vibe-forge/core'
import type { SessionInfo } from '@vibe-forge/types'
import { CurrentTodoList } from './CurrentTodoList'
import { NewSessionGuide } from './NewSessionGuide'
import { MessageItem } from './messages/MessageItem'
import { processMessages } from './messages/message-utils'
import { Sender } from './sender/Sender'
import { ToolGroup } from './tools/core/ToolGroup'

export function ChatHistoryView({
  isReady,
  messages,
  session,
  sessionInfo,
  errorBanner,
  onRetryConnection,
  interactionRequest,
  onInteractionResponse,
  setMessages,
  onClearMessages,
  placeholder,
  modelMenuGroups,
  modelSearchOptions,
  recommendedModelOptions,
  servicePreviewModelOptions,
  onToggleRecommendedModel,
  updatingRecommendedModelValue,
  selectedModel,
  modelForQuery,
  onModelChange,
  effort,
  effortOptions,
  onEffortChange,
  permissionMode,
  permissionModeOptions,
  onPermissionModeChange,
  selectedAdapter,
  adapterOptions,
  onAdapterChange,
  modelUnavailable,
  hasAvailableModels
}: {
  isReady: boolean
  messages: ChatMessage[]
  session?: Session
  sessionInfo: SessionInfo | null
  errorBanner?: ChatErrorBannerState | null
  onRetryConnection: () => void
  interactionRequest: { id: string; payload: AskUserQuestionParams } | null
  onInteractionResponse: (id: string, data: string | string[]) => void
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  onClearMessages: () => void
  placeholder?: string
  modelMenuGroups: ModelSelectMenuGroup[]
  modelSearchOptions: ModelSelectOption[]
  recommendedModelOptions: ModelSelectOption[]
  servicePreviewModelOptions: ModelSelectOption[]
  onToggleRecommendedModel: (option: ModelSelectOption) => void | Promise<void>
  updatingRecommendedModelValue?: string
  selectedModel?: string
  modelForQuery?: string
  onModelChange: (model: string) => void
  effort: ChatEffort
  effortOptions: Array<{ value: ChatEffort; label: React.ReactNode }>
  onEffortChange: (effort: ChatEffort) => void
  permissionMode: PermissionMode
  permissionModeOptions: Array<{ value: PermissionMode; label: React.ReactNode }>
  onPermissionModeChange: (mode: PermissionMode) => void
  selectedAdapter?: string
  adapterOptions: Array<{ value: string; label: React.ReactNode }>
  onAdapterChange: (adapter: string) => void
  modelUnavailable: boolean
  hasAvailableModels: boolean
}) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const location = useLocation()
  const { messagesEndRef, messagesContainerRef, messagesContentRef, showScrollBottom, scrollToBottom } = useChatScroll({
    messagesLength: messages.length
  })
  const {
    isCreating,
    send,
    sendContent,
    editMessage,
    forkMessage,
    interrupt,
    clearMessages,
    recallMessage
  } = useChatSessionActions({
    session,
    modelForQuery,
    hasAvailableModels,
    effort,
    permissionMode,
    adapter: selectedAdapter,
    onClearMessages
  })
  const initialScrollDoneRef = useRef(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
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

  const handleSend = async (text: string) => {
    if (!session?.id) {
      const optimisticMessage = buildUserMessage(text)
      setMessages((prev) => [...prev, optimisticMessage])
      const didSend = await send(text)
      if (!didSend) {
        setMessages((prev) => prev.filter((message) => message.id !== optimisticMessage.id))
      }
      return
    }

    const didSend = await send(text)
    if (didSend) {
      setMessages((prev) => [...prev, buildUserMessage(text)])
    }
  }
  const handleSendContent = async (content: ChatMessageContent[]) => {
    if (!session?.id) {
      const optimisticMessage = buildUserMessage(content)
      setMessages((prev) => [...prev, optimisticMessage])
      const didSend = await sendContent(content)
      if (!didSend) {
        setMessages((prev) => prev.filter((message) => message.id !== optimisticMessage.id))
      }
      return
    }

    const didSend = await sendContent(content)
    if (didSend) {
      setMessages((prev) => [...prev, buildUserMessage(content)])
    }
  }
  useEffect(() => {
    initialScrollDoneRef.current = false
    setEditingMessageId(null)
  }, [session?.id])
  useEffect(() => {
    if (!initialScrollDoneRef.current && isReady && location.hash === '') {
      scrollToBottom('auto')
      initialScrollDoneRef.current = true
    }
  }, [isReady, location.hash, messages.length, scrollToBottom])
  useEffect(() => {
    if (location.hash === '' && !showScrollBottom) {
      scrollToBottom('auto')
    }
  }, [location.hash, messages.length, scrollToBottom, showScrollBottom])
  const handleStartEditing = (messageId: string) => {
    let isBlocked = false

    setEditingMessageId((current) => {
      if (current != null && current !== messageId) {
        isBlocked = true
        return current
      }

      return messageId
    })

    if (isBlocked) {
      void message.warning(t('chat.messageActions.editInProgress'))
    }
  }
  const isInlineEditing = editingMessageId != null
  const renderItems = useMemo(() => processMessages(messages), [messages])
  const lastAssistantActionAnchorId = useMemo(() => {
    for (let index = renderItems.length - 1; index >= 0; index -= 1) {
      const item = renderItems[index]
      if (item == null) continue
      if (item.type === 'tool-group') continue
      if (item.message.role === 'user') continue
      return item.anchorId
    }
    return null
  }, [renderItems])

  useEffect(() => {
    const hash = decodeURIComponent(location.hash.replace(/^#/, ''))
    if (!isReady || hash === '') return

    let removeHighlightTimer: ReturnType<typeof setTimeout> | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let frameId: number | null = null

    const scrollToAnchor = () => {
      const target = document.getElementById(hash)
      if (target == null) {
        return false
      }

      target.scrollIntoView({ block: 'center', behavior: 'auto' })
      target.classList.add('is-anchor-target')
      removeHighlightTimer = setTimeout(() => {
        target.classList.remove('is-anchor-target')
      }, 1800)
      return true
    }

    if (!scrollToAnchor()) {
      frameId = requestAnimationFrame(() => {
        if (!scrollToAnchor()) {
          retryTimer = setTimeout(() => {
            void scrollToAnchor()
          }, 120)
        }
      })
    }

    return () => {
      if (frameId != null) {
        cancelAnimationFrame(frameId)
      }
      if (retryTimer != null) {
        clearTimeout(retryTimer)
      }
      if (removeHighlightTimer != null) {
        clearTimeout(removeHighlightTimer)
      }
    }
  }, [isReady, location.hash, renderItems.length])

  return (
    <>
      <div className={`chat-messages ${isReady ? 'ready' : ''}`} ref={messagesContainerRef}>
        <div className='chat-messages-content' ref={messagesContentRef}>
          {!session?.id && isCreating && (
            <div className='chat-pending-session-banner'>
              <span className='material-symbols-rounded'>hourglass_top</span>
              <span>{t('common.creatingChat')}</span>
            </div>
          )}
          {renderItems.map((item, index) => {
            if (item.type === 'message') {
              return (
                <MessageItem
                  key={item.message.id || index}
                  anchorId={item.anchorId}
                  msg={item.message}
                  isFirstInGroup={item.isFirstInGroup}
                  originalMessage={item.originalMessage}
                  sessionInfo={sessionInfo}
                  isEditing={editingMessageId === item.originalMessage.id}
                  isSessionBusy={isCreating || session?.status === 'running' || session?.status === 'waiting_input'}
                  showAssistantActions={item.anchorId === lastAssistantActionAnchorId}
                  onEditMessage={editMessage}
                  onForkMessage={forkMessage}
                  onRecallMessage={recallMessage}
                  onStartEditing={handleStartEditing}
                  onCancelEditing={(messageId) => {
                    setEditingMessageId((current) => current === messageId ? null : current)
                  }}
                  sessionId={session?.id}
                />
              )
            } else if (item.type === 'tool-group') {
              return (
                <ToolGroup
                  key={item.id || `group-${index}`}
                  anchorId={item.anchorId}
                  items={item.items}
                  originalMessage={item.originalMessage}
                  sessionId={session?.id}
                  footer={item.footer}
                />
              )
            }
            return null
          })}
          <div ref={messagesEndRef} />
        </div>

        {showScrollBottom && (
          <div className='scroll-bottom-btn' onClick={() => scrollToBottom()}>
            <span className='material-symbols-rounded'>arrow_downward</span>
          </div>
        )}
      </div>

      {!session?.id && messages.length === 0 && (
        <div className='new-session-guide-wrapper'>
          <NewSessionGuide />
        </div>
      )}

      <CurrentTodoList messages={messages} />
      {!isInlineEditing && (
        <div className='sender-container'>
          <Sender
            onSend={handleSend}
            onSendContent={handleSendContent}
            adapterLocked={session?.id != null}
            sessionStatus={isCreating ? 'running' : session?.status}
            onInterrupt={interrupt}
            onClear={clearMessages}
            sessionInfo={sessionInfo}
            errorBanner={errorBanner}
            onRetryConnection={onRetryConnection}
            interactionRequest={interactionRequest}
            onInteractionResponse={onInteractionResponse}
            placeholder={placeholder}
            modelMenuGroups={modelMenuGroups}
            modelSearchOptions={modelSearchOptions}
            recommendedModelOptions={recommendedModelOptions}
            servicePreviewModelOptions={servicePreviewModelOptions}
            onToggleRecommendedModel={onToggleRecommendedModel}
            updatingRecommendedModelValue={updatingRecommendedModelValue}
            selectedModel={selectedModel}
            onModelChange={onModelChange}
            effort={effort}
            effortOptions={effortOptions}
            onEffortChange={onEffortChange}
            permissionMode={permissionMode}
            permissionModeOptions={permissionModeOptions}
            onPermissionModeChange={onPermissionModeChange}
            selectedAdapter={selectedAdapter}
            adapterOptions={adapterOptions}
            onAdapterChange={onAdapterChange}
            modelUnavailable={modelUnavailable}
          />
        </div>
      )}
    </>
  )
}
