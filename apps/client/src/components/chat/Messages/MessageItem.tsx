import './MessageItem.scss'
import type { ChatMessage } from '@vibe-forge/core'
import React from 'react'
import { MessageFooter } from './MessageFooter'
import { MarkdownContent } from '#~/components/MarkdownContent'
import { ToolRenderer } from '../tools/core/ToolRenderer'

type MessageItemProps = {
  msg: ChatMessage
  isFirstInGroup: boolean
}

function MessageItemComponent({
  msg,
  isFirstInGroup
}: MessageItemProps) {
  const isUser = msg.role === 'user'

  const renderContent = () => {
    if (msg.content == null) return null

    if (typeof msg.content === 'string') {
      return (
        <MarkdownContent content={msg.content} />
      )
    }

    if (!Array.isArray(msg.content)) return null

    const hasContent = msg.content.some(c => c.type === 'text' || c.type === 'image') || msg.toolCall != null
    if (!hasContent) return null

    return (
      <div className='message-contents'>
        {msg.content.map((item, i) => {
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

  return (
    <div
      className={`${isUser ? 'chat-message-user' : 'chat-message-assistant'} ${!isFirstInGroup ? 'consecutive' : ''}`}
    >
      <div className='message-body-container'>
        <div className='bubble'>
          {content}
        </div>
        <MessageFooter msg={msg} isUser={isUser} />
      </div>
    </div>
  )
}

const areMessageItemPropsEqual = (prev: MessageItemProps, next: MessageItemProps) => {
  return prev.isFirstInGroup === next.isFirstInGroup
    && prev.msg.id === next.msg.id
    && prev.msg.role === next.msg.role
    && prev.msg.createdAt === next.msg.createdAt
    && prev.msg.model === next.msg.model
    && prev.msg.content === next.msg.content
    && prev.msg.toolCall === next.msg.toolCall
    && prev.msg.usage === next.msg.usage
}

export const MessageItem = React.memo(MessageItemComponent, areMessageItemPropsEqual)
