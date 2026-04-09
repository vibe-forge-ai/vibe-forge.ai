import './MessageItem.scss'

import { App } from 'antd'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import type { ChatMessage, ChatMessageContent } from '@vibe-forge/core'
import type { SessionInfo } from '@vibe-forge/types'

import { MarkdownContent } from '#~/components/MarkdownContent'
import { Sender } from '../sender/Sender'
import { ToolRenderer } from '../tools/core/ToolRenderer'
import { MessageContextMenu } from './MessageContextMenu'
import { MessageFooter } from './MessageFooter'
import {
  getCopyableMessageText,
  getEditableMessageContent,
  isSameEditableMessageContent,
  normalizeEditableMessageContent
} from './message-content-utils'

interface MessageItemProps {
  anchorId: string
  msg: ChatMessage
  isFirstInGroup: boolean
  originalMessage: ChatMessage
  isTargeted: boolean
  sessionId?: string
  sessionInfo?: SessionInfo | null
  isSessionBusy: boolean
  isEditing: boolean
  showAssistantActions: boolean
  onEditMessage: (messageId: string, content: string | ChatMessageContent[]) => Promise<boolean>
  onRecallMessage: (messageId: string) => Promise<boolean>
  onForkMessage: (messageId: string) => Promise<boolean>
  onStartEditing: (messageId: string) => void
  onCancelEditing: (messageId: string) => void
}

type PendingConfirmAction = 'fork' | 'recall' | null

const ACTION_SHOW_DELAY_MS = 90
const ACTION_HIDE_DELAY_MS = 140

function MessageItemComponent({
  anchorId,
  msg,
  isFirstInGroup,
  originalMessage,
  isTargeted,
  sessionId,
  sessionInfo,
  isSessionBusy,
  isEditing,
  showAssistantActions,
  onEditMessage,
  onRecallMessage,
  onForkMessage,
  onStartEditing,
  onCancelEditing
}: MessageItemProps) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [searchParams] = useSearchParams()
  const isDebugMode = searchParams.get('debug') === 'true'
  const isUser = msg.role === 'user'
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isActionsVisible, setIsActionsVisible] = useState(false)
  const [pendingConfirmAction, setPendingConfirmAction] = useState<PendingConfirmAction>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const showActionsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideActionsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editableContent = useMemo(() => getEditableMessageContent(msg), [msg])
  const copyableText = useMemo(() => getCopyableMessageText(msg), [msg])
  const actionMessageId = originalMessage.id
  const isPersistedMessage = sessionId != null && sessionId !== '' && !actionMessageId.startsWith('local-')
  const canEdit = isPersistedMessage && !isSessionBusy && isUser && editableContent != null
  const canRecall = isPersistedMessage && !isSessionBusy && isUser
  const canFork = isPersistedMessage && !isSessionBusy && isUser
  const canCopy = copyableText != null
  const shouldShowAssistantActions = !isUser && showAssistantActions

  useEffect(() => {
    setIsSubmitting(false)
  }, [isEditing, msg.id])

  useEffect(() => {
    if (isEditing) {
      setIsActionsVisible(false)
      setPendingConfirmAction(null)
    }
  }, [isEditing])

  useEffect(() => {
    return () => {
      if (showActionsTimerRef.current != null) {
        clearTimeout(showActionsTimerRef.current)
      }
      if (hideActionsTimerRef.current != null) {
        clearTimeout(hideActionsTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isActionsVisible) {
      setPendingConfirmAction(null)
    }
  }, [isActionsVisible])

  useEffect(() => {
    if (pendingConfirmAction == null) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const nextTarget = event.target
      if (!(nextTarget instanceof Node)) {
        setPendingConfirmAction(null)
        return
      }

      if (!wrapperRef.current?.contains(nextTarget)) {
        setPendingConfirmAction(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
    }
  }, [pendingConfirmAction])

  const renderContent = () => {
    if (msg.content == null) return null

    if (typeof msg.content === 'string') {
      return (
        <MarkdownContent content={msg.content} />
      )
    }

    if (!Array.isArray(msg.content)) return null

    const hasContent = msg.content.some((c: ChatMessageContent) => (
      c.type === 'text' || c.type === 'image' || c.type === 'file'
    )) ||
      msg.toolCall != null
    if (!hasContent) return null

    return (
      <div className='message-contents'>
        {msg.content.map((item: ChatMessageContent, i: number) => {
          if (item.type === 'text') {
            return (
              <MarkdownContent key={i} content={item.text} />
            )
          }
          if (item.type === 'image') {
            return (
              <a key={i} className='message-image' href={item.url} target='_blank' rel='noreferrer'>
                <img src={item.url} alt={item.name ?? 'image'} />
              </a>
            )
          }
          if (item.type === 'file') {
            return (
              <div key={i} className='message-context-file'>
                <span className='material-symbols-rounded message-context-file__icon'>description</span>
                <code className='message-context-file__path'>{item.path}</code>
              </div>
            )
          }
          return null
        })}
        {msg.toolCall != null && (
          <ToolRenderer
            item={{
              type: 'tool_use',
              id: msg.toolCall.id ?? 'legacy',
              name: msg.toolCall.name,
              input: msg.toolCall.args
            }}
            resultItem={msg.toolCall.output != null
              ? {
                type: 'tool_result',
                tool_use_id: msg.toolCall.id ?? 'legacy',
                content: msg.toolCall.output,
                is_error: msg.toolCall.status === 'error'
              }
              : undefined}
          />
        )}
      </div>
    )
  }

  const content = renderContent()
  if (content == null) return null

  const handleStartEdit = () => {
    if (editableContent == null) return
    setPendingConfirmAction(null)
    onStartEditing(actionMessageId)
  }

  const submitEditedContent = async (nextContent: string | ChatMessageContent[]) => {
    const normalizedNextContent = normalizeEditableMessageContent(nextContent)
    if (normalizedNextContent == null || isSameEditableMessageContent(normalizedNextContent, editableContent)) {
      onCancelEditing(actionMessageId)
      return true
    }

    setIsSubmitting(true)
    try {
      const didCreateBranch = await onEditMessage(actionMessageId, normalizedNextContent)
      if (didCreateBranch) {
        onCancelEditing(actionMessageId)
      }
      return didCreateBranch
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitEditText = async (nextText: string) => {
    return submitEditedContent(nextText)
  }

  const handleSubmitEditContent = async (nextContent: ChatMessageContent[]) => {
    return submitEditedContent(nextContent)
  }

  const handleCopyRawText = async () => {
    if (copyableText == null) {
      return
    }

    setPendingConfirmAction(null)
    try {
      await navigator.clipboard.writeText(copyableText)
      void message.success(t('chat.messageActions.copySuccess'))
    } catch {
      void message.error(t('chat.messageActions.copyFailed'))
    }
  }

  const handleRecall = async () => {
    setPendingConfirmAction(null)
    await onRecallMessage(actionMessageId)
  }

  const handleFork = async () => {
    setPendingConfirmAction(null)
    await onForkMessage(actionMessageId)
  }

  const handleConfirmableActionClick = (action: Exclude<PendingConfirmAction, null>) => {
    if (pendingConfirmAction === action) {
      if (action === 'recall') {
        void handleRecall()
        return
      }

      void handleFork()
      return
    }

    setPendingConfirmAction(action)
  }

  const handleActionsPointerEnter = () => {
    if (!isUser || isEditing) {
      return
    }

    if (hideActionsTimerRef.current != null) {
      clearTimeout(hideActionsTimerRef.current)
      hideActionsTimerRef.current = null
    }

    if (isActionsVisible || showActionsTimerRef.current != null) {
      return
    }

    showActionsTimerRef.current = setTimeout(() => {
      setIsActionsVisible(true)
      showActionsTimerRef.current = null
    }, ACTION_SHOW_DELAY_MS)
  }

  const handleActionsPointerLeave = () => {
    if (!isUser) {
      return
    }

    if (showActionsTimerRef.current != null) {
      clearTimeout(showActionsTimerRef.current)
      showActionsTimerRef.current = null
    }

    if (!isActionsVisible || hideActionsTimerRef.current != null) {
      return
    }

    hideActionsTimerRef.current = setTimeout(() => {
      setIsActionsVisible(false)
      setPendingConfirmAction(null)
      hideActionsTimerRef.current = null
    }, ACTION_HIDE_DELAY_MS)
  }

  const actionButtons = (
    <>
      {canCopy && (
        <button
          type='button'
          className='msg-action-button msg-action-button--copy'
          title={t('chat.messageActions.copy')}
          aria-label={t('chat.messageActions.copy')}
          onClick={() => {
            void handleCopyRawText()
          }}
        >
          <span className='material-symbols-rounded'>content_copy</span>
        </button>
      )}
      {canEdit && (
        <button
          type='button'
          className='msg-action-button msg-action-button--edit'
          title={t('chat.messageActions.edit')}
          aria-label={t('chat.messageActions.edit')}
          onClick={handleStartEdit}
        >
          <span className='material-symbols-rounded'>edit</span>
        </button>
      )}
      {canRecall && (
        <button
          type='button'
          className={`msg-action-button msg-action-button--recall ${
            pendingConfirmAction === 'recall' ? 'is-confirming' : ''
          }`}
          title={pendingConfirmAction === 'recall'
            ? t('chat.messageActions.confirmInline')
            : t('chat.messageActions.recall')}
          aria-label={pendingConfirmAction === 'recall'
            ? t('chat.messageActions.confirmInline')
            : t('chat.messageActions.recall')}
          onClick={() => {
            handleConfirmableActionClick('recall')
          }}
        >
          <span className='material-symbols-rounded'>undo</span>
          {pendingConfirmAction === 'recall' && (
            <span className='msg-action-button__label'>{t('chat.messageActions.confirmInline')}</span>
          )}
        </button>
      )}
      {canFork && (
        <button
          type='button'
          className={`msg-action-button msg-action-button--fork ${
            pendingConfirmAction === 'fork' ? 'is-confirming' : ''
          }`}
          title={pendingConfirmAction === 'fork'
            ? t('chat.messageActions.confirmInline')
            : t('chat.messageActions.fork')}
          aria-label={pendingConfirmAction === 'fork'
            ? t('chat.messageActions.confirmInline')
            : t('chat.messageActions.fork')}
          onClick={() => {
            handleConfirmableActionClick('fork')
          }}
        >
          <span className='material-symbols-rounded'>fork_right</span>
          {pendingConfirmAction === 'fork' && (
            <span className='msg-action-button__label'>{t('chat.messageActions.confirmInline')}</span>
          )}
        </button>
      )}
    </>
  )

  return (
    <MessageContextMenu
      anchorId={anchorId}
      canEdit={canEdit}
      canFork={canFork}
      canRecall={canRecall}
      copyableText={copyableText}
      isDebugMode={isDebugMode}
      isEditing={isEditing}
      message={originalMessage}
      sessionId={sessionId}
      onFork={handleFork}
      onRecall={handleRecall}
      onStartEditing={handleStartEdit}
    >
      <div
        ref={wrapperRef}
        id={anchorId}
        className={`${isUser ? 'chat-message-user' : 'chat-message-assistant'} ${isEditing ? 'is-editing' : ''} ${
          !isFirstInGroup ? 'consecutive' : ''
        } ${isActionsVisible ? 'is-actions-visible' : ''} ${isTargeted ? 'is-targeted' : ''}`}
        data-message-id={originalMessage.id}
        onPointerEnter={handleActionsPointerEnter}
        onPointerLeave={handleActionsPointerLeave}
      >
        <div className={`message-body-container ${isEditing ? 'is-editing' : ''}`}>
          {isUser && !isEditing && (
            <div className='message-side-actions'>
              {actionButtons}
            </div>
          )}
          <div className={`bubble ${isEditing ? 'is-editing' : ''}`}>
            {isEditing
              ? (
                <div className='message-inline-editor'>
                  <Sender
                    variant='inline-edit'
                    sessionInfo={sessionInfo}
                    initialContent={editableContent}
                    submitLabel={t('chat.send')}
                    submitLoading={isSubmitting}
                    autoFocus
                    onCancel={() => {
                      onCancelEditing(actionMessageId)
                    }}
                    onSend={handleSubmitEditText}
                    onSendContent={handleSubmitEditContent}
                    onInterrupt={() => {}}
                  />
                </div>
              )
              : content}
          </div>
          {!isEditing && (
            <MessageFooter msg={originalMessage} isUser={isUser}>
              {shouldShowAssistantActions ? actionButtons : undefined}
            </MessageFooter>
          )}
        </div>
      </div>
    </MessageContextMenu>
  )
}

const areMessageItemPropsEqual = (prev: MessageItemProps, next: MessageItemProps) => {
  return prev.anchorId === next.anchorId &&
    prev.isFirstInGroup === next.isFirstInGroup &&
    prev.isTargeted === next.isTargeted &&
    prev.isSessionBusy === next.isSessionBusy &&
    prev.isEditing === next.isEditing &&
    prev.sessionId === next.sessionId &&
    prev.sessionInfo === next.sessionInfo &&
    prev.showAssistantActions === next.showAssistantActions &&
    prev.msg.id === next.msg.id &&
    prev.msg.role === next.msg.role &&
    prev.msg.createdAt === next.msg.createdAt &&
    prev.msg.model === next.msg.model &&
    prev.msg.content === next.msg.content &&
    prev.msg.toolCall === next.msg.toolCall &&
    prev.msg.usage === next.msg.usage &&
    prev.originalMessage === next.originalMessage
}

export const MessageItem = React.memo(MessageItemComponent, areMessageItemPropsEqual)
