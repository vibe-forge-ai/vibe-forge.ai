import type { ChatMessage } from '@vibe-forge/core'
import { App } from 'antd'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

export function MessageFooter({
  msg,
  isUser,
  children
}: {
  msg: ChatMessage
  isUser: boolean
  children?: ReactNode
}) {
  const { t, i18n } = useTranslation()
  const { message } = App.useApp()
  const [searchParams] = useSearchParams()
  const isDebugMode = searchParams.get('debug') === 'true'
  const timestampLocale = i18n.resolvedLanguage?.startsWith('zh') === true ? 'zh-CN' : 'en-US'
  const totalTokens = msg.usage != null ? msg.usage.input_tokens + msg.usage.output_tokens : undefined
  const hasVisibleContent = children != null ||
    (isUser && msg.model != null) ||
    (isUser && totalTokens != null) ||
    isDebugMode

  if (!hasVisibleContent) {
    return null
  }

  return (
    <div className='msg-footer'>
      {children}
      {isUser && msg.model != null && (
        <span className='msg-model'>
          {msg.model.split(',').pop()}
        </span>
      )}
      {isUser && totalTokens != null && (
        <span className='msg-usage'>
          {t('chat.messageFooter.tokens')}: {totalTokens}
        </span>
      )}
      {isDebugMode && (
        <span
          className='timestamp'
          onDoubleClick={() => {
            // eslint-disable-next-line no-console
            console.log('Debug Message:', msg)
            void navigator.clipboard.writeText(new Date(msg.createdAt).toISOString())
            void message.success(t('chat.messageFooter.copyTimestampSuccess'))
          }}
          title={t('chat.messageFooter.copyTimestampTitle')}
        >
          {new Date(msg.createdAt).toLocaleString(timestampLocale, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          })}
        </span>
      )}
    </div>
  )
}
