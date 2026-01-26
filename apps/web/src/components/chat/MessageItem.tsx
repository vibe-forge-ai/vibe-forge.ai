import './MessageItem.scss'
import type { ChatMessage } from '@vibe-forge/core'
import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from './CodeBlock'
import { MessageFooter } from './MessageFooter'
import { ToolRenderer } from './ToolRenderer'

export function MessageItem({
  msg,
  isFirstInGroup
}: {
  msg: ChatMessage
  isFirstInGroup: boolean
}) {
  const isUser = msg.role === 'user'

  const renderContent = () => {
    if (msg.content == null) return null

    if (typeof msg.content === 'string') {
      return (
        <div className='markdown-body'>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              pre({ children }) {
                return <>{children}</>
              },
              code({ inline, className, children, ...props }: any) {
                const langClass = typeof className === 'string' ? className : ''
                const match = /language-(\w+)/.exec(langClass)
                const isInline = inline === true
                const codeContent = String(children).replace(/\n$/, '')
                return !isInline && match != null
                  ? (
                    <CodeBlock
                      code={codeContent}
                      lang={match[1]}
                    />
                  )
                  : (
                    <code className={langClass} {...props}>
                      {children}
                    </code>
                  )
              }
            }}
          >
            {msg.content}
          </ReactMarkdown>
        </div>
      )
    }

    if (!Array.isArray(msg.content)) return null

    const hasContent = msg.content.some(c => c.type === 'text') || msg.toolCall != null
    if (!hasContent) return null

    return (
      <div className='message-contents'>
        {msg.content.map((item, i) => {
          if (item.type === 'text') {
            return (
              <div key={i} className='markdown-body'>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    pre({ children }) {
                      return <>{children}</>
                    },
                    code({ inline, className, children, ...props }: any) {
                      const langClass = typeof className === 'string' ? className : ''
                      const match = /language-(\w+)/.exec(langClass)
                      const isInline = inline === true
                      const codeContent = String(children).replace(/\n$/, '')
                      return !isInline && match != null
                        ? (
                          <CodeBlock
                            code={codeContent}
                            lang={match[1]}
                          />
                        )
                        : (
                          <code className={langClass} {...props}>
                            {children}
                          </code>
                        )
                    }
                  }}
                >
                  {item.text}
                </ReactMarkdown>
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
