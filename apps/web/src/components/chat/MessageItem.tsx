import './MessageItem.scss'
import type { ChatMessage, ChatMessageContent } from '@vibe-forge/core'
import { App } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ToolRenderer } from './ToolRenderer'

export function MessageItem({
  msg,
  isFirstInGroup,
  allMessages,
  index
}: {
  msg: ChatMessage
  isFirstInGroup: boolean
  allMessages: ChatMessage[]
  index: number
}) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const isUser = msg.role === 'user'

  const renderContent = () => {
    if (msg.content == null) return null

    if (typeof msg.content === 'string') {
      return (
        <div className='markdown-body'>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {msg.content}
          </ReactMarkdown>
        </div>
      )
    }

    if (!Array.isArray(msg.content)) return null

    const renderedItems: React.ReactNode[] = []
    let i = 0
    while (i < msg.content.length) {
      const item = msg.content[i]
      if (item == null) {
        i++
        continue
      }

      if (item.type === 'tool_use') {
        let resultItem = msg.content.find((r, idx) =>
          idx > i && r != null && r.type === 'tool_result' && r.tool_use_id === item.id
        ) as Extract<ChatMessageContent, { type: 'tool_result' }> | undefined

        if (resultItem == null && allMessages != null) {
          for (let j = index + 1; j < allMessages.length; j++) {
            const nextMsg = allMessages[j]
            if (nextMsg != null && Array.isArray(nextMsg.content)) {
              const found = nextMsg.content.find(r =>
                r != null && r.type === 'tool_result' && r.tool_use_id === item.id
              )
              if (found != null) {
                resultItem = found as Extract<ChatMessageContent, { type: 'tool_result' }>
                break
              }
            }
            if (nextMsg != null && nextMsg.role === 'assistant') break
          }
        }

        renderedItems.push(
          <ToolRenderer key={item.id || i} item={item} resultItem={resultItem} />
        )
      } else if (item.type === 'text') {
        renderedItems.push(
          <div key={i} className='markdown-body'>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {item.text}
            </ReactMarkdown>
          </div>
        )
      } else if (item.type === 'tool_result') {
        const hasCallInCurrent = msg.content.some((c, idx) =>
          idx < i && c != null && c.type === 'tool_use' && c.id === item.tool_use_id
        )
        const hasCallInPrevious = allMessages != null
          && allMessages.slice(0, index).some(prevMsg =>
            prevMsg != null && Array.isArray(prevMsg.content)
            && prevMsg.content.some(c => c != null && c.type === 'tool_use' && c.id === item.tool_use_id)
          )

        if (hasCallInCurrent === false && hasCallInPrevious === false) {
          renderedItems.push(
            <ToolRenderer
              key={item.tool_use_id || i}
              item={{ type: 'tool_use', id: item.tool_use_id, name: t('chat.tools.unknown'), input: {} }}
              resultItem={item}
            />
          )
        }
      }
      i++
    }

    if (renderedItems.length === 0) return null

    return (
      <div className='message-contents'>
        {renderedItems}
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

  const handleDoubleClick = () => {
    // no-op
  }

  const content = renderContent()
  if (content == null) return null

  return (
    <div
      className={`${isUser ? 'chat-message-user' : 'chat-message-assistant'} ${!isFirstInGroup ? 'consecutive' : ''}`}
      onDoubleClick={handleDoubleClick}
    >
      <div className='message-body-container'>
        <div className='bubble'>
          {content}
        </div>
        <div className='msg-footer'>
          {isUser && msg.model != null && (
            <span className='msg-model'>
              {msg.model.split(',').pop()}
            </span>
          )}
          {isUser && msg.usage != null && (
            <span className='msg-usage'>
              Tokens: {msg.usage.input_tokens + msg.usage.output_tokens}
            </span>
          )}
          <span
            className='timestamp'
            onDoubleClick={() => {
              void navigator.clipboard.writeText(new Date(msg.createdAt).toISOString())
              void message.success('ISO 时间已复制到剪贴板')
            }}
            title='双击复制 ISO 时间'
          >
            {new Date(msg.createdAt).toLocaleString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false
            })}
          </span>
        </div>
      </div>
    </div>
  )
}
