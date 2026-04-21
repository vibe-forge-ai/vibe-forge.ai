import { Button } from 'antd'
import { useTranslation } from 'react-i18next'

export interface NewSessionGuideResourceItem {
  key: string
  name: string
  description?: string
  meta?: string
  active?: boolean
  onSelect: () => void
}

export function NewSessionGuideResourceCard({
  icon,
  title,
  count,
  isReady,
  items,
  emptyText,
  createLabel,
  onCreate
}: {
  icon: string
  title: string
  count: number
  isReady: boolean
  items: NewSessionGuideResourceItem[]
  emptyText: string
  createLabel?: string
  onCreate?: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className='new-session-guide__card'>
      <div className='new-session-guide__header'>
        <div className='new-session-guide__title'>
          <span className='material-symbols-rounded new-session-guide__title-icon'>{icon}</span>
          <span>{title}</span>
        </div>
        <div className='new-session-guide__count'>{count}</div>
      </div>
      <div className='new-session-guide__body'>
        {!isReady && (
          <div className='new-session-guide__loading'>{t('chat.newSessionGuide.loading')}</div>
        )}
        {isReady && items.length > 0 && (
          <div className='new-session-guide__list'>
            {items.map((item) => (
              <button
                key={item.key}
                type='button'
                className={[
                  'new-session-guide__item',
                  'new-session-guide__item--button',
                  item.active === true ? 'is-active' : ''
                ].filter(Boolean).join(' ')}
                aria-pressed={item.active === true}
                onClick={item.onSelect}
              >
                <div className='new-session-guide__item-title'>
                  <span>{item.name}</span>
                </div>
                {item.description != null && item.description !== '' && (
                  <div className='new-session-guide__item-desc'>{item.description}</div>
                )}
                {item.meta != null && item.meta !== '' && (
                  <div className='new-session-guide__meta'>{item.meta}</div>
                )}
              </button>
            ))}
          </div>
        )}
        {isReady && items.length === 0 && (
          <div className='new-session-guide__empty'>
            <div className='new-session-guide__empty-desc'>{emptyText}</div>
            {createLabel != null && onCreate != null && (
              <Button type='primary' size='small' onClick={onCreate}>
                {createLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
