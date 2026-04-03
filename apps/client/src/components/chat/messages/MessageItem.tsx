import './MessageItem.scss'

import { App } from 'antd'
import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ChatMessage, ChatMessageContent } from '@vibe-forge/core'
import type { SessionInfo } from '@vibe-forge/types'

import { MarkdownContent } from '#~/components/MarkdownContent'
import { Sender } from '../sender/Sender'
import { ToolRenderer } from '../tools/core/ToolRenderer'
import { MessageFooter } from './MessageFooter'

type EditableMessageContent = string | ChatMessageContent[]

interface MessageItemProps {
  msg: ChatMessage
  isFirstInGroup: boolean
  sessionId?: string
  sessionInfo?: SessionInfo | null
  isSessionBusy: boolean
  isEditing: boolean
  onEditMessage: (messageId: string, content: string | ChatMessageContent[]) => Promise<boolean>
  onRecallMessage: (messageId: string) => Promise<boolean>
  onForkMessage: (messageId: string) => Promise<boolean>
  onStartEditing: (messageId: string) => void
  onCancelEditing: (messageId: string) => void
}

const cloneEditableMessageContent = (content: EditableMessageContent) => {
  if (typeof content === 'string') {
    return content
  }

  return content.map((item) => {
    if (item.type === 'text') {
      return { type: 'text', text: item.text } satisfies ChatMessageContent
    }

    return {
      type: 'image',
      url: item.url,
      name: item.name,
      size: item.size,
      mimeType: item.mimeType
    } satisfies ChatMessageContent
  })
}

const normalizeEditableMessageContent = (content: EditableMessageContent | undefined) => {
  if (content == null) {
    return undefined
  }

  if (typeof content === 'string') {
    const trimmed = content.trim()
    return trimmed === '' ? undefined : trimmed
  }

  const normalized: ChatMessageContent[] = []
  for (const item of content) {
    if (item.type === 'text') {
      const text = item.text.trim()
      if (text !== '') {
        normalized.push({ type: 'text', text })
      }
      continue
    }

    if (item.type === 'image') {
      normalized.push({
        type: 'image',
        url: item.url,
        name: item.name,
        size: item.size,
        mimeType: item.mimeType
      })
      continue
    }

    return undefined
  }

  return normalized.length === 0 ? undefined : normalized
}

const getEditableMessageContent = (message: ChatMessage) => {
  if (typeof message.content === 'string') {
    const trimmed = message.content.trim()
    return trimmed === '' ? undefined : message.content
  }

  if (!Array.isArray(message.content) || message.toolCall != null) {
    return undefined
  }

  const editableItems = message.content.filter((item) => item.type === 'text' || item.type === 'image')
  if (editableItems.length !== message.content.length || editableItems.length === 0) {
    return undefined
  }

  const hasVisibleContent = editableItems.some((item) => item.type === 'image' || item.text.trim() !== '')
  if (!hasVisibleContent) {
    return undefined
  }

  return cloneEditableMessageContent(editableItems)
}

const isSameEditableMessageContent = (
  left: EditableMessageContent | undefined,
  right: EditableMessageContent | undefined
) => {
  const normalizedLeft = normalizeEditableMessageContent(left)
  const normalizedRight = normalizeEditableMessageContent(right)

  return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight)
}

const getCopyableMessageText = (message: ChatMessage) => {
  if (typeof message.content === 'string') {
    return message.content.trim() === '' ? undefined : message.content
  }

  if (!Array.isArray(message.content)) {
    return undefined
  }

  const textItems = message.content
    .filter((item): item is Extract<ChatMessageContent, { type: 'text' }> => item.type === 'text')
    .map(item => item.text)
    .filter(text => text.trim() !== '')

  if (textItems.length === 0) {
    return undefined
  }

  return textItems.join('\n\n')
}

function MessageItemComponent({
  msg,
  isFirstInGroup,
  sessionId,
  sessionInfo,
  isSessionBusy,
  isEditing,
  onEditMessage,
  onRecallMessage,
  onForkMessage,
  onStartEditing,
  onCancelEditing
}: MessageItemProps) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const isUser = msg.role === 'user'
  const [isSubmitting, setIsSubmitting] = useState(false)
  const editableContent = useMemo(() => getEditableMessageContent(msg), [msg])
  const copyableText = useMemo(() => getCopyableMessageText(msg), [msg])
  const isPersistedMessage = sessionId != null && sessionId !== '' && !msg.id.startsWith('local-')
  const canEdit = isPersistedMessage && !isSessionBusy && isUser && editableContent != null
  const canRecall = isPersistedMessage && !isSessionBusy && isUser
  const canFork = isPersistedMessage && !isSessionBusy && isUser
  const canCopy = copyableText != null

  useEffect(() => {
    setIsSubmitting(false)
  }, [isEditing, msg.id])

  const renderContent = () => {
    if (msg.content == null) return null

    if (typeof msg.content === 'string') {
      return (
        <MarkdownContent content={msg.content} />
      )
    }

    if (!Array.isArray(msg.content)) return null

    const hasContent = msg.content.some((c: ChatMessageContent) => c.type === 'text' || c.type === 'image') ||
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
    onStartEditing(msg.id)
  }

  const handleSubmitEdit = async (nextContent: EditableMessageContent) => {
    const normalizedNextContent = normalizeEditableMessageContent(nextContent)
    if (normalizedNextContent == null || isSameEditableMessageContent(normalizedNextContent, editableContent)) {
      onCancelEditing(msg.id)
      return true
    }

    setIsSubmitting(true)
    try {
      const didCreateBranch = await onEditMessage(msg.id, normalizedNextContent)
      if (didCreateBranch) {
        onCancelEditing(msg.id)
      }
      return didCreateBranch
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCopyRawText = async () => {
    if (copyableText == null) {
      return
    }

    try {
      await navigator.clipboard.writeText(copyableText)
      void message.success(t('chat.messageActions.copySuccess'))
    } catch {
      void message.error(t('chat.messageActions.copyFailed'))
    }
  }

  return (
    <div
      className={`${isUser ? 'chat-message-user' : 'chat-message-assistant'} ${isEditing ? 'is-editing' : ''} ${
        !isFirstInGroup ? 'consecutive' : ''
      }`}
    >
      <div className={`message-body-container ${isEditing ? 'is-editing' : ''}`}>
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
                      onCancelEditing(msg.id)
                    }}
                    onSend={handleSubmitEdit}
                    onSendContent={handleSubmitEdit}
                    onInterrupt={() => {}}
                  />
                </div>
              )
            : content}
        </div>
        {!isEditing && (
          <MessageFooter msg={msg} isUser={isUser}>
            {canCopy && (
              <button
                type='button'
                className='msg-action-button'
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
                className='msg-action-button'
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
                className='msg-action-button'
                title={t('chat.messageActions.recall')}
                aria-label={t('chat.messageActions.recall')}
                onClick={() => {
                  void onRecallMessage(msg.id)
                }}
              >
                <span className='material-symbols-rounded'>undo</span>
              </button>
            )}
            {canFork && (
              <button
                type='button'
                className='msg-action-button'
                title={t('chat.messageActions.fork')}
                aria-label={t('chat.messageActions.fork')}
                onClick={() => {
                  void onForkMessage(msg.id)
                }}
              >
                <span className='material-symbols-rounded'>fork_right</span>
              </button>
            )}
          </MessageFooter>
        )}
      </div>
    </div>
  )
}

const areMessageItemPropsEqual = (prev: MessageItemProps, next: MessageItemProps) => {
  return prev.isFirstInGroup === next.isFirstInGroup &&
    prev.isSessionBusy === next.isSessionBusy &&
    prev.isEditing === next.isEditing &&
    prev.sessionId === next.sessionId &&
    prev.sessionInfo === next.sessionInfo &&
    prev.msg.id === next.msg.id &&
    prev.msg.role === next.msg.role &&
    prev.msg.createdAt === next.msg.createdAt &&
    prev.msg.model === next.msg.model &&
    prev.msg.content === next.msg.content &&
    prev.msg.toolCall === next.msg.toolCall &&
    prev.msg.usage === next.msg.usage
}

export const MessageItem = React.memo(MessageItemComponent, areMessageItemPropsEqual)
