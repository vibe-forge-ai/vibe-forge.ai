import './MessageStatusNotice.scss'

import { Button } from 'antd'
import { useTranslation } from 'react-i18next'

import type { ChatHistoryStatusNotice } from './build-chat-history-status-notices'

export function MessageStatusNotice({
  notice,
  onRetryConnection
}: {
  notice: ChatHistoryStatusNotice
  onRetryConnection: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className={`message-status-notice message-status-notice--${notice.tone} ${notice.isMock ? 'is-mock' : ''}`}>
      <div className='message-status-notice__card' role='status' aria-live='polite'>
        <div className='message-status-notice__content'>
          <div className='message-status-notice__header'>
            <div className='message-status-notice__title-row'>
              <span className='material-symbols-rounded message-status-notice__icon'>{notice.icon}</span>
              <div className='message-status-notice__title'>{notice.title}</div>
              {notice.isMock && (
                <span className='message-status-notice__badge'>{t('chat.debugMockLabel')}</span>
              )}
            </div>
            {notice.meta != null && notice.meta !== '' && (
              <span className='message-status-notice__meta'>{notice.meta}</span>
            )}
          </div>
          <div className='message-status-notice__message'>{notice.message}</div>
          {notice.detail != null && notice.detail !== '' && (
            <div className='message-status-notice__detail'>{notice.detail}</div>
          )}
          {notice.action === 'retry-connection' && (
            <div className='message-status-notice__actions'>
              <Button size='small' onClick={onRetryConnection}>
                {t('chat.retryConnection')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
