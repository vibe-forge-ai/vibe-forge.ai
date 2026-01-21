import type { Session } from '@vibe-forge/core'
import { Badge, Button, Checkbox, Input, List, Popconfirm, Space, Tag, Tooltip } from 'antd'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)

interface SessionItemProps {
  session: Session
  isActive: boolean
  isBatchMode: boolean
  isSelected: boolean
  onSelect: (session: Session) => void
  onArchive: (id: string) => void | Promise<void>
  onDelete: (id: string) => void | Promise<void>
  onStar: (id: string, isStarred: boolean) => void | Promise<void>
  onUpdateTags: (id: string, tags: string[]) => void | Promise<void>
  onToggleSelect: (id: string) => void
}

export function SessionItem({
  session,
  isActive,
  isBatchMode,
  isSelected,
  onSelect,
  onArchive,
  onDelete,
  onStar,
  onUpdateTags,
  onToggleSelect
}: SessionItemProps) {
  const { t, i18n } = useTranslation()
  const [isAddingTag, setIsAddingTag] = React.useState(false)
  const [newTag, setNewTag] = React.useState('')

  const timeDisplay = useMemo(() => {
    const d = dayjs(session.createdAt)
    if (i18n.language === 'zh') {
      d.locale('zh-cn')
    } else {
      d.locale('en')
    }
    return {
      relative: d.fromNow(),
      full: d.format('YYYY-MM-DD HH:mm:ss')
    }
  }, [session.createdAt, i18n.language])

  const displayTitle = (session.title != null && session.title !== '')
    ? session.title
    : (session.lastUserMessage != null && session.lastUserMessage !== '')
    ? session.lastUserMessage
    : t('common.newChat')
  const messageCount = session.messageCount ?? 0

  const lastMessageSnippet = useMemo(() => {
    if (session.lastMessage == null || session.lastMessage === '') return null
    return session.lastMessage.length > 60 ? `${session.lastMessage.slice(0, 60)}...` : session.lastMessage
  }, [session.lastMessage])

  return (
    <List.Item
      onClick={() => isBatchMode ? onToggleSelect(session.id) : onSelect(session)}
      className={`session-item ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''} ${
        session.isStarred ? 'starred' : ''
      }`}
    >
      <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '8px' }}>
        {isBatchMode && (
          <div
            style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Checkbox
              checked={isSelected}
              onChange={() => onToggleSelect(session.id)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0, paddingRight: isBatchMode ? '0' : '48px' }}>
          <div
            className='session-title'
            style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span
              className='material-symbols-outlined'
              style={{ color: 'inherit', fontSize: '18px', opacity: isActive ? 1 : 0.6 }}
            >
              chat_bubble
            </span>
            <span
              className='session-title-text'
              style={{ fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {displayTitle}
            </span>
            {messageCount > 0 && (
              <Badge
                count={messageCount > 99 ? '99+' : messageCount}
                style={{
                  backgroundColor: isActive ? '#3b82f6' : '#f3f4f6',
                  color: isActive ? '#fff' : '#6b7280',
                  fontSize: '10px',
                  height: '16px',
                  lineHeight: '16px',
                  minWidth: '16px',
                  padding: '0 6px',
                  boxShadow: 'none',
                  flexShrink: 0,
                  border: 'none'
                }}
              />
            )}
          </div>
          {lastMessageSnippet != null && (
            <div
              style={{
                fontSize: '12px',
                color: '#6b7280',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginBottom: '4px'
              }}
            >
              {lastMessageSnippet}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Tooltip title={timeDisplay.full}>
              <span>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                  {timeDisplay.relative}
                </div>
              </span>
            </Tooltip>
          </div>
          <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
            {session.tags?.map(tag => (
              <Tag
                key={tag}
                style={{ fontSize: '10px', margin: 0, padding: '0 4px', lineHeight: '14px', borderRadius: '2px' }}
              >
                {tag}
              </Tag>
            ))}
          </div>
        </div>
      </div>

      {!isBatchMode && (
        <div
          className='session-item-actions'
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            gap: '2px',
            zIndex: 10
          }}
        >
          <Tooltip title={session.isStarred ? t('common.unstar') : t('common.star')}>
            <Button
              type='text'
              size='small'
              className='action-btn'
              onClick={(e) => {
                e.stopPropagation()
                void onStar(session.id, !session.isStarred)
              }}
              icon={
                <span
                  className='material-symbols-outlined'
                  style={{
                    fontSize: 18,
                    color: session.isStarred ? '#f59e0b' : undefined,
                    fontVariationSettings: session.isStarred ? "'FILL' 1" : undefined
                  }}
                >
                  star
                </span>
              }
            />
          </Tooltip>
          <Tooltip title={t('common.archive')}>
            <Button
              type='text'
              size='small'
              className='action-btn archive-btn'
              onClick={(e) => {
                e.stopPropagation()
                void onArchive(session.id)
              }}
              icon={<span className='material-symbols-outlined' style={{ fontSize: 18 }}>archive</span>}
            />
          </Tooltip>
        </div>
      )}
    </List.Item>
  )
}
