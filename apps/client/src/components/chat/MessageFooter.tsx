import type { ChatMessage } from '@vibe-forge/core'
import { App } from 'antd'
import React from 'react'

export function MessageFooter({
  msg,
  isUser
}: {
  msg: ChatMessage
  isUser: boolean
}) {
  const { message } = App.useApp()

  return (
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
          // eslint-disable-next-line no-console
          console.log('Debug Message:', msg)
          void navigator.clipboard.writeText(new Date(msg.createdAt).toISOString())
          void message.success('ISO 时间已复制到剪贴板')
        }}
        title='双击复制 ISO 时间 (控制台打印消息结构)'
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
  )
}
