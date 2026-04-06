import './ThinkingStatus.scss'

import type { SessionStatus } from '@vibe-forge/core'
import { useTranslation } from 'react-i18next'

export function ThinkingStatus({
  variant = 'inline',
  status = 'running'
}: {
  variant?: 'inline' | 'header'
  status?: Extract<SessionStatus, 'running' | 'waiting_input'>
}) {
  const { t } = useTranslation()

  const label = status === 'waiting_input'
    ? t('common.status.waiting_input')
    : t('chat.thinking')

  return (
    <div className={`chat-thinking-status chat-thinking-status--${variant} chat-thinking-status--${status}`.trim()}>
      {status === 'running'
        ? (
          <span className='chat-thinking-status__dots' aria-hidden='true'>
            <span className='chat-thinking-status__dot' />
            <span className='chat-thinking-status__dot' />
            <span className='chat-thinking-status__dot' />
          </span>
        )
        : (
          <span className='material-symbols-rounded chat-thinking-status__icon' aria-hidden='true'>
            pending_actions
          </span>
        )}
      <span className='chat-thinking-status__label'>{label}</span>
    </div>
  )
}
