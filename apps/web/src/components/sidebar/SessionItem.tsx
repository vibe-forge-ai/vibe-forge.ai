import './SessionItem.scss'

import type { Session, SessionStatus } from '@vibe-forge/core'
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

  const getStatusIcon = (status?: SessionStatus) => {
    if (!status) {
      return <div className={`status-dot ${isActive ? 'active' : ''}`} />
    }
    
    let icon = ''
    let color = ''
    const title = t(`common.status.${status}`)
    
    switch (status) {
      case 'completed':
        icon = 'check_circle'
        color = '#52c41a' // Green
        break
      case 'terminated':
        icon = 'remove_circle'
        color = '#bfbfbf' // Grey
        break
      case 'failed':
        icon = 'cancel'
        color = '#ff4d4f' // Red
        break
      case 'running':
        icon = 'sync'
        color = '#1890ff' // Blue
        break
      case 'waiting_input':
        return (
          <Tooltip title={title}>
            <div className='waiting-input-indicator' />
          </Tooltip>
        )
      default:
        return <div className={`status-dot ${isActive ? 'active' : ''}`} />
    }
    
    return (
      <Tooltip title={title}>
        <span 
          className={`material-symbols-rounded status-icon ${status === 'running' ? 'spin' : ''}`}
          style={{ 
            color, 
            fontSize: '16px',
            lineHeight: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {icon}
        </span>
      </Tooltip>
    )
  }

  return (
    <List.Item
      onClick={() => isBatchMode ? onToggleSelect(session.id) : onSelect(session)}
      onDoubleClick={() => {
        // eslint-disable-next-line no-console
        console.log('Session Details:', session)
      }}
      className={`session-item ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''} ${
        session.isStarred ? 'starred' : ''
      }`}
    >
      <div className='session-item-content'>
        {!isBatchMode && (
          <div className='status-indicator'>
            {getStatusIcon(session.status)}
          </div>
        )}
        {isBatchMode && (
          <div className='batch-checkbox-wrapper'>
            <Checkbox
              checked={isSelected}
              onChange={() => onToggleSelect(session.id)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
        <div className={`session-info ${isBatchMode ? '' : 'with-actions'}`}>
          <div className='session-header'>
            <div className='session-title'>
              <span className='session-title-text'>
                {displayTitle}
              </span>
            </div>
            {!isBatchMode && (
              <div className='session-item-actions'>
                <Tooltip title={session.isStarred ? t('common.unstar') : t('common.star')}>
                  <Button
                    type='text'
                    size='small'
                    className={`action-btn ${session.isStarred ? 'starred' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      void onStar(session.id, !session.isStarred)
                    }}
                    icon={
                      <span
                        className={`material-symbols-rounded ${session.isStarred ? 'filled' : ''}`}
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
                    icon={<span className='material-symbols-rounded'>archive</span>}
                  />
                </Tooltip>
              </div>
            )}
          </div>
          {lastMessageSnippet != null && (
            <div className='last-message'>
              {lastMessageSnippet}
            </div>
          )}
          <div className='session-meta'>
            {session.status && (
              <span className='status-text' style={{ fontSize: '11px', color: 'var(--sub-text-color)', marginRight: '8px' }}>
                {t(`common.status.${session.status}`)}
              </span>
            )}
            <Tooltip title={timeDisplay.full}>
              <span className='time-display'>
                {timeDisplay.relative}
              </span>
            </Tooltip>
          </div>
          <div className='tags-container'>
            {session.tags?.map(tag => (
              <Tag
                key={tag}
                className='session-tag'
              >
                {tag}
              </Tag>
            ))}
          </div>
        </div>
      </div>

      {messageCount > 0 && (
        <Badge
          count={messageCount > 99 ? '99+' : messageCount}
          className='session-item-badge'
        />
      )}
    </List.Item>
  )
}
