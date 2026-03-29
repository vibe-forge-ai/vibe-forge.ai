import React, { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import type { PermissionMode } from '#~/hooks/chat/use-chat-permission-mode'
import { useChatScroll } from '#~/hooks/chat/use-chat-scroll'
import { useChatSessionActions } from '#~/hooks/chat/use-chat-session-actions'
import type { SessionInfo } from '@vibe-forge/types'
import type { AskUserQuestionParams, ChatMessage, ChatMessageContent, Session } from '@vibe-forge/core'
import { CurrentTodoList } from './CurrentTodoList'
import { NewSessionGuide } from './NewSessionGuide'
import { MessageItem } from './messages/MessageItem'
import { processMessages } from './messages/message-utils'
import { Sender } from './sender/Sender'
import { ToolGroup } from './tools/core/ToolGroup'

interface ModelSelectOption {
  value: string
  label: React.ReactNode
  searchText: string
  displayLabel: string
}

interface ModelSelectGroup {
  label: React.ReactNode
  options: ModelSelectOption[]
}

export function ChatHistoryView({
  isReady,
  messages,
  session,
  sessionInfo,
  connectionError,
  onRetryConnection,
  interactionRequest,
  onInteractionResponse,
  setMessages,
  onClearMessages,
  placeholder,
  modelOptions,
  selectedModel,
  modelForQuery,
  onModelChange,
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
  connectionError?: string | null
  onRetryConnection: () => void
  interactionRequest: { id: string; payload: AskUserQuestionParams } | null
  onInteractionResponse: (id: string, data: string | string[]) => void
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  onClearMessages: () => void
  placeholder?: string
  modelOptions: ModelSelectGroup[]
  selectedModel?: string
  modelForQuery?: string
  onModelChange: (model: string) => void
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
  const { messagesEndRef, messagesContainerRef, messagesContentRef, showScrollBottom, scrollToBottom } = useChatScroll({
    messagesLength: messages.length
  })
  const { isCreating, send, sendContent, interrupt, clearMessages } = useChatSessionActions({
    session,
    modelForQuery,
    hasAvailableModels,
    permissionMode,
    adapter: selectedAdapter,
    onClearMessages
  })
  const initialScrollDoneRef = useRef(false)
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
  const renderItems = useMemo(() => processMessages(messages), [messages])

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

      <CurrentTodoList messages={messages} />
      <div className='sender-container'>
        <Sender
          onSend={handleSend}
          onSendContent={handleSendContent}
          adapterLocked={session?.id != null}
          sessionStatus={isCreating ? 'running' : session?.status}
          onInterrupt={interrupt}
          onClear={clearMessages}
          sessionInfo={sessionInfo}
          connectionError={connectionError}
          onRetryConnection={onRetryConnection}
          interactionRequest={interactionRequest}
          onInteractionResponse={onInteractionResponse}
          placeholder={placeholder}
          modelOptions={modelOptions}
          selectedModel={selectedModel}
          onModelChange={onModelChange}
          permissionMode={permissionMode}
          permissionModeOptions={permissionModeOptions}
          onPermissionModeChange={onPermissionModeChange}
          selectedAdapter={selectedAdapter}
          adapterOptions={adapterOptions}
          onAdapterChange={onAdapterChange}
          modelUnavailable={modelUnavailable}
        />
      </div>
    </>
  )
}
