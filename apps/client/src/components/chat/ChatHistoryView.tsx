import React, { useEffect, useMemo, useRef } from 'react'

import type { PermissionMode } from '#~/hooks/chat/use-chat-permission-mode'
import { useChatScroll } from '#~/hooks/chat/use-chat-scroll'
import { useChatSessionActions } from '#~/hooks/chat/use-chat-session-actions'
import type { AskUserQuestionParams, ChatMessage, ChatMessageContent, Session, SessionInfo } from '@vibe-forge/core'
import { CurrentTodoList } from './CurrentTodoList'
import { MessageItem } from './messages/MessageItem'
import { processMessages } from './messages/message-utils'
import { NewSessionGuide } from './NewSessionGuide'
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
  onClearMessages,
  onSend,
  onSendContent,
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
  onClearMessages: () => void
  onSend: (text: string) => void
  onSendContent: (content: ChatMessageContent[]) => void
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
  const handleSend = async (text: string) => {
    await send(text)
    if (session?.id) {
      onSend(text)
    }
  }
  const handleSendContent = async (content: ChatMessageContent[]) => {
    await sendContent(content)
    onSendContent(content)
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

      {!session?.id && (
        <div className='new-session-guide-wrapper'>
          <NewSessionGuide />
        </div>
      )}

      <CurrentTodoList messages={messages} />
      <div className='sender-container'>
        <Sender
          onSend={handleSend}
          onSendContent={handleSendContent}
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
