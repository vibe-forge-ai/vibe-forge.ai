import './QueuedMessagesCard.scss'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ChatMessageContent, SessionQueuedMessage, SessionQueuedMessageMode } from '@vibe-forge/core'

import { ChatComposerCard } from './ChatComposerCard'

const getSummaryText = (content: ChatMessageContent[]) => {
  const text = content
    .filter((item): item is Extract<ChatMessageContent, { type: 'text' }> => item.type === 'text')
    .map(item => item.text.trim())
    .filter(Boolean)
    .join('\n')

  return text
}

const getContentFlags = (content: ChatMessageContent[]) => ({
  hasImages: content.some(item => item.type === 'image'),
  hasReferences: content.some(item => item.type === 'file')
})

const reorderIds = (ids: string[], draggedId: string, targetId: string) => {
  if (draggedId === targetId) {
    return ids
  }

  const current = [...ids]
  const fromIndex = current.indexOf(draggedId)
  const toIndex = current.indexOf(targetId)
  if (fromIndex === -1 || toIndex === -1) {
    return ids
  }

  current.splice(fromIndex, 1)
  current.splice(toIndex, 0, draggedId)
  return current
}

export function QueuedMessagesCard({
  mode,
  items,
  onMove,
  onDelete,
  onEdit,
  onReorder
}: {
  mode: SessionQueuedMessageMode
  items: SessionQueuedMessage[]
  onMove: (item: SessionQueuedMessage, targetMode: SessionQueuedMessageMode) => void | Promise<unknown>
  onDelete: (item: SessionQueuedMessage) => void | Promise<unknown>
  onEdit: (item: SessionQueuedMessage) => void | Promise<unknown>
  onReorder: (ids: string[]) => void | Promise<unknown>
}) {
  const { t } = useTranslation()
  const [draggedId, setDraggedId] = useState<string | null>(null)

  const summaryLabel = mode === 'next'
    ? t('chat.queue.nextTitle')
    : t('chat.queue.steerTitle')
  const summaryCount = t('chat.queue.count', { count: items.length })

  if (items.length === 0) {
    return null
  }

  const targetMode = mode === 'next' ? 'steer' : 'next'

  return (
    <ChatComposerCard
      className='queued-messages-card'
      summaryClassName='queued-messages-card__summary'
      bodyClassName='queued-messages-card__body'
      narrow
      summary={
        <div className='queued-messages-card__headline'>
          <span className='material-symbols-rounded queued-messages-card__headline-icon'>
            {mode === 'next' ? 'pending' : 'schedule'}
          </span>
          <div className='queued-messages-card__headline-copy'>
            <div className='queued-messages-card__headline-title'>{summaryLabel}</div>
            <div className='queued-messages-card__headline-meta'>{summaryCount}</div>
          </div>
        </div>
      }
    >
      <div className='queued-messages-card__list'>
        {items.map((item) => {
          const summaryText = getSummaryText(item.content)
          const { hasImages, hasReferences } = getContentFlags(item.content)
          return (
            <div
              key={item.id}
              className='queued-messages-card__item'
              draggable
              onDragStart={() => setDraggedId(item.id)}
              onDragEnd={() => setDraggedId(null)}
              onDragOver={(event) => {
                event.preventDefault()
              }}
              onDrop={(event) => {
                event.preventDefault()
                if (draggedId == null) {
                  return
                }
                const nextIds = reorderIds(items.map(queueItem => queueItem.id), draggedId, item.id)
                setDraggedId(null)
                void onReorder(nextIds)
              }}
            >
              <div className='queued-messages-card__item-main'>
                <span className='queued-messages-card__drag material-symbols-rounded' aria-hidden='true'>
                  drag_indicator
                </span>
                <div className='queued-messages-card__item-copy'>
                  <div className='queued-messages-card__item-summary'>
                    {(hasImages || hasReferences) && (
                      <div className='queued-messages-card__flags'>
                        {hasImages && (
                          <span className='queued-messages-card__flag' title={t('chat.queue.hasImage')}>
                            <span className='material-symbols-rounded'>image</span>
                          </span>
                        )}
                        {hasReferences && (
                          <span className='queued-messages-card__flag' title={t('chat.queue.hasReference')}>
                            <span className='material-symbols-rounded'>attach_file</span>
                          </span>
                        )}
                      </div>
                    )}
                    <div className='queued-messages-card__item-text'>
                      {summaryText !== '' ? summaryText : t('chat.queue.attachmentsOnly')}
                    </div>
                  </div>
                </div>
              </div>
              <div className='queued-messages-card__actions'>
                <button
                  type='button'
                  className='queued-messages-card__action queued-messages-card__action--move'
                  onClick={() => void onMove(item, targetMode)}
                  title={t(targetMode === 'next' ? 'chat.queue.moveToNext' : 'chat.queue.moveToSteer')}
                  aria-label={t(targetMode === 'next' ? 'chat.queue.moveToNext' : 'chat.queue.moveToSteer')}
                >
                  <span className='material-symbols-rounded'>swap_horiz</span>
                </button>
                <button
                  type='button'
                  className='queued-messages-card__action queued-messages-card__action--edit'
                  onClick={() => void onEdit(item)}
                >
                  <span className='material-symbols-rounded'>edit</span>
                </button>
                <button
                  type='button'
                  className='queued-messages-card__action queued-messages-card__action--delete'
                  onClick={() => void onDelete(item)}
                >
                  <span className='material-symbols-rounded'>delete</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </ChatComposerCard>
  )
}
