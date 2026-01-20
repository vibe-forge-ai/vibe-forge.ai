import type { Session } from '@vibe-forge/core'
import { Badge, Button, Checkbox, Input, List, Space, Tag, Tooltip } from 'antd'
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
    : (session.lastMessage != null && session.lastMessage !== '')
    ? session.lastMessage
    : t('common.newChat')
  const messageCount = session.messageCount ?? 0

  return (
    <List.Item
      style={{
        cursor: 'pointer',
        background: isActive ? '#f2f4f5' : undefined,
        padding: '12px 16px',
        position: 'relative'
      }}
      onClick={() => isBatchMode ? onToggleSelect(session.id) : onSelect(session)}
      className={`session-item ${isSelected ? 'selected' : ''} ${session.isStarred ? 'starred' : ''}`}
    >
      <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '12px' }}>
        {isBatchMode && (
          <Checkbox
            checked={isSelected}
            onChange={() => onToggleSelect(session.id)}
            onClick={(e) => e.stopPropagation()}
          />
        )}
        <div style={{ flex: 1, minWidth: 0, paddingRight: isBatchMode ? '0' : '48px' }}>
          <div
            className='session-title'
            style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span
              className='material-symbols-outlined'
              style={{ color: isActive ? '#3b82f6' : '#9ca3af', fontSize: '18px' }}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Tooltip title={timeDisplay.full}>
              <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                {timeDisplay.relative}
              </div>
            </Tooltip>
          </div>
          <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
            {session.tags?.map(tag => (
              <Tag
                key={tag}
                closable
                onClose={(e) => {
                  e.preventDefault()
                  const nextTags = session.tags?.filter(t => t !== tag) ?? []
                  void onUpdateTags(session.id, nextTags)
                }}
                style={{ fontSize: '10px', margin: 0, padding: '0 4px', lineHeight: '14px', borderRadius: '2px' }}
              >
                {tag}
              </Tag>
            ))}
            {isAddingTag
              ? (
                <Input
                  size='small'
                  autoFocus
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onBlur={() => {
                    setIsAddingTag(false)
                    setNewTag('')
                  }}
                  onPressEnter={() => {
                    if (newTag.trim() !== '') {
                      const nextTags = Array.from(new Set([...(session.tags ?? []), newTag.trim()]))
                      void onUpdateTags(session.id, nextTags)
                    }
                    setIsAddingTag(false)
                    setNewTag('')
                  }}
                  style={{ width: '60px', fontSize: '10px', padding: '0 4px', height: '16px' }}
                />
              )
              : (
                <Tag
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsAddingTag(true)
                  }}
                  style={{
                    fontSize: '10px',
                    margin: 0,
                    padding: '0 4px',
                    lineHeight: '14px',
                    borderRadius: '2px',
                    borderStyle: 'dashed',
                    cursor: 'pointer',
                    background: 'transparent'
                  }}
                >
                  + {t('common.addTag', 'Tag')}
                </Tag>
              )}
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
            gap: '2px'
          }}
        >
          <Tooltip title={session.isStarred ? t('common.unstar', 'Unstar') : t('common.star', 'Star')}>
            <Button
              type='text'
              size='small'
              className={`action-btn star-btn ${session.isStarred ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                void onStar(session.id, !session.isStarred)
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                padding: 0,
                color: session.isStarred ? '#f59e0b' : '#d1d5db'
              }}
            >
              <span
                className='material-symbols-outlined'
                style={{
                  fontSize: 18,
                  display: 'block',
                  lineHeight: 1,
                  fontVariationSettings: session.isStarred ? "'FILL' 1" : undefined
                }}
              >
                star
              </span>
            </Button>
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
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                padding: 0,
                color: '#d1d5db'
              }}
            >
              <span className='material-symbols-outlined' style={{ fontSize: 18, display: 'block', lineHeight: 1 }}>
                archive
              </span>
            </Button>
          </Tooltip>
        </div>
      )}
    </List.Item>
  )
}
