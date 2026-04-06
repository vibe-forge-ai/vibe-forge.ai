import { App } from 'antd'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ChatErrorBannerState } from '#~/hooks/chat/interaction-state'
import type { ChatEffort } from '#~/hooks/chat/use-chat-effort'
import type { ModelSelectMenuGroup, ModelSelectOption } from '#~/hooks/chat/use-chat-model-adapter-selection'
import type { PermissionMode } from '#~/hooks/chat/use-chat-permission-mode'
import { useChatScroll } from '#~/hooks/chat/use-chat-scroll'
import { useChatSessionActions } from '#~/hooks/chat/use-chat-session-actions'
import type {
  AskUserQuestionParams,
  ChatMessage,
  ChatMessageContent,
  Session,
  SessionMessageQueueState,
  SessionQueuedMessage,
  SessionQueuedMessageMode
} from '@vibe-forge/core'
import type { SessionInfo } from '@vibe-forge/types'
import { CurrentTodoList } from './CurrentTodoList'
import { NewSessionGuide } from './NewSessionGuide'
import { QueuedMessagesCard } from './QueuedMessagesCard'
import { MessageItem } from './messages/MessageItem'
import { processMessages } from './messages/message-utils'
import { SenderInteractionPanel } from './sender/@components/sender-interaction-panel/SenderInteractionPanel'
import { Sender } from './sender/Sender'
import { ToolGroup } from './tools/core/ToolGroup'

export function ChatHistoryView({
  isReady,
  messages,
  session,
  sessionInfo,
  errorBanner,
  queuedMessages,
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
  queuedMessages: SessionMessageQueueState
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
  const { messagesEndRef, messagesContainerRef, messagesContentRef, showScrollBottom, scrollToBottom } = useChatScroll({
    messagesLength: messages.length
  })
  const {
    isCreating,
    send,
    sendContent,
    enqueueContent,
    removeQueuedContent,
    moveQueuedContent,
    reorderQueuedContent,
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
  const [queueMode, setQueueMode] = useState<SessionQueuedMessageMode>('steer')
  const [queuedDraft, setQueuedDraft] = useState<{ content: ChatMessageContent[] } | null>(null)
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

  const handleSendContent = async (content: ChatMessageContent[], mode?: SessionQueuedMessageMode) => {
    const resolvedMode = mode ?? queueMode

    if (session?.id && session.status === 'running') {
      const didQueue = await enqueueContent(resolvedMode, content)
      if (didQueue && queuedDraft != null) {
        setQueuedDraft(null)
        setQueueMode('steer')
      }
      return didQueue
    }

    if (!session?.id) {
      const optimisticMessage = buildUserMessage(content)
      setMessages((prev) => [...prev, optimisticMessage])
      const didSend = await sendContent(content, mode)
      if (!didSend) {
        setMessages((prev) => prev.filter((message) => message.id !== optimisticMessage.id))
      }
      if (didSend && queuedDraft != null) {
        setQueuedDraft(null)
        setQueueMode('steer')
      }
      return didSend
    }

    const didSend = await sendContent(content, mode)
    if (didSend) {
      setMessages((prev) => [...prev, buildUserMessage(content)])
      if (queuedDraft != null) {
        setQueuedDraft(null)
        setQueueMode('steer')
      }
    }
    return didSend
  }

  const handleSend = async (text: string, mode?: SessionQueuedMessageMode) => {
    const resolvedMode = mode ?? queueMode

    if (session?.id && session.status === 'running') {
      const didQueue = await enqueueContent(resolvedMode, [{ type: 'text', text: text.trim() }])
      if (didQueue && queuedDraft != null) {
        setQueuedDraft(null)
        setQueueMode('steer')
      }
      return didQueue
    }

    if (!session?.id) {
      const optimisticMessage = buildUserMessage(text)
      setMessages((prev) => [...prev, optimisticMessage])
      const didSend = await send(text, mode)
      if (!didSend) {
        setMessages((prev) => prev.filter((message) => message.id !== optimisticMessage.id))
      }
      if (didSend && queuedDraft != null) {
        setQueuedDraft(null)
        setQueueMode('steer')
      }
      return didSend
    }

    const didSend = await send(text, mode)
    if (didSend) {
      setMessages((prev) => [...prev, buildUserMessage(text)])
      if (queuedDraft != null) {
        setQueuedDraft(null)
        setQueueMode('steer')
      }
    }
    return didSend
  }
  useEffect(() => {
    initialScrollDoneRef.current = false
    setEditingMessageId(null)
    setQueuedDraft(null)
    setQueueMode('steer')
  }, [session?.id])
  useEffect(() => {
    if (!initialScrollDoneRef.current && isReady) {
      scrollToBottom('auto')
      initialScrollDoneRef.current = true
    }
  }, [isReady, messages.length, scrollToBottom])
  useEffect(() => {
    if (!showScrollBottom) {
      scrollToBottom('auto')
    }
  }, [messages.length, scrollToBottom, showScrollBottom])
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
  const handleEditQueuedMessage = async (item: SessionQueuedMessage) => {
    const removed = await removeQueuedContent(item.id)
    if (!removed) {
      return
    }
    setQueuedDraft({ content: item.content })
    setQueueMode('steer')
  }
  const handleMoveQueuedMessage = async (item: SessionQueuedMessage, targetMode: SessionQueuedMessageMode) => {
    await moveQueuedContent(item.id, targetMode)
  }

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
                  msg={item.message}
                  isFirstInGroup={item.isFirstInGroup}
                  sessionInfo={sessionInfo}
                  isEditing={editingMessageId === item.message.id}
                  isSessionBusy={isCreating || session?.status === 'running' || session?.status === 'waiting_input'}
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
                  items={item.items}
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

      <div className='chat-composer-stack'>
        <div className='chat-composer-stack__inner'>
          <CurrentTodoList messages={messages} />
          {!isInlineEditing && (
            <QueuedMessagesCard
              mode='next'
              items={queuedMessages.next}
              onMove={(item, targetMode) => void handleMoveQueuedMessage(item, targetMode)}
              onDelete={(item) => void removeQueuedContent(item.id)}
              onEdit={(item) => void handleEditQueuedMessage(item)}
              onReorder={(ids) => reorderQueuedContent('next', ids)}
            />
          )}
          {!isInlineEditing && (
            <QueuedMessagesCard
              mode='steer'
              items={queuedMessages.steer}
              onMove={(item, targetMode) => void handleMoveQueuedMessage(item, targetMode)}
              onDelete={(item) => void removeQueuedContent(item.id)}
              onEdit={(item) => void handleEditQueuedMessage(item)}
              onReorder={(ids) => reorderQueuedContent('steer', ids)}
            />
          )}
          {!isInlineEditing && interactionRequest != null && (
            <SenderInteractionPanel
              interactionRequest={interactionRequest}
              permissionContext={interactionRequest.payload.kind === 'permission'
                ? interactionRequest.payload.permissionContext
                : undefined}
              deniedTools={interactionRequest.payload.kind === 'permission'
                ? (interactionRequest.payload.permissionContext?.deniedTools ?? [])
                : []}
              reasons={interactionRequest.payload.kind === 'permission'
                ? (interactionRequest.payload.permissionContext?.reasons ?? [])
                : []}
              onInteractionResponse={onInteractionResponse}
            />
          )}
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
                initialContent={queuedDraft?.content}
                placeholder={placeholder}
                submitLabel={queuedDraft != null ? t('chat.queue.requeueMessage') : undefined}
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
                queueMode={queueMode}
                onQueueModeChange={setQueueMode}
              />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
