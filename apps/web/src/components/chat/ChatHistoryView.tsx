import React, { useMemo } from 'react'

import type { AskUserQuestionParams, ChatMessage, Session, SessionInfo } from '@vibe-forge/core'
import { CurrentTodoList } from './CurrentTodoList'
import { MessageItem } from './MessageItem'
import { NewSessionGuide } from './NewSessionGuide'
import { Sender } from './Sender'
import { ToolGroup } from './ToolGroup'
import { processMessages } from './messageUtils'

interface ModelSelectOption {
  value: string
  label: React.ReactNode
  searchText: string
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
  isCreating,
  showScrollBottom,
  messagesContainerRef,
  messagesEndRef,
  scrollToBottom,
  interactionRequest,
  onInteractionResponse,
  onSend,
  onInterrupt,
  onClear,
  placeholder,
  modelOptions,
  selectedModel,
  onModelChange,
  modelUnavailable
}: {
  isReady: boolean
  messages: ChatMessage[]
  session?: Session
  sessionInfo: SessionInfo | null
  isCreating: boolean
  showScrollBottom: boolean
  messagesContainerRef: React.RefObject<HTMLDivElement>
  messagesEndRef: React.RefObject<HTMLDivElement>
  scrollToBottom: (behavior?: ScrollBehavior) => void
  interactionRequest: { id: string; payload: AskUserQuestionParams } | null
  onInteractionResponse: (id: string, data: string | string[]) => void
  onSend: (text: string) => void
  onInterrupt: () => void
  onClear: () => void
  placeholder?: string
  modelOptions: ModelSelectGroup[]
  selectedModel?: string
  onModelChange: (model: string) => void
  modelUnavailable: boolean
}) {
  const renderItems = useMemo(() => processMessages(messages), [messages])

  return (
    <>
      <div className={`chat-messages ${isReady ? 'ready' : ''}`} ref={messagesContainerRef}>
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
          onSend={onSend}
          sessionStatus={isCreating ? 'running' : session?.status}
          onInterrupt={onInterrupt}
          onClear={onClear}
          sessionInfo={sessionInfo}
          interactionRequest={interactionRequest}
          onInteractionResponse={onInteractionResponse}
          placeholder={placeholder}
          modelOptions={modelOptions}
          selectedModel={selectedModel}
          onModelChange={onModelChange}
          modelUnavailable={modelUnavailable}
        />
      </div>
    </>
  )
}
