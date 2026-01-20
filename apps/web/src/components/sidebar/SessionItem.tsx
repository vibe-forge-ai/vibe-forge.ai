import type { Session } from '@vibe-forge/core'
import { Badge, Button, Checkbox, List, Popconfirm, Tooltip } from 'antd'
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
  onDelete: (id: string) => void
  onToggleSelect: (id: string) => void
}

export function SessionItem({
  session,
  isActive,
  isBatchMode,
  isSelected,
  onSelect,
  onDelete,
  onToggleSelect
}: SessionItemProps) {
  const { t, i18n } = useTranslation()

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
      className={`session-item ${isSelected ? 'selected' : ''}`}
    >
      <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '12px' }}>
        {isBatchMode && (
          <Checkbox
            checked={isSelected}
            onChange={() => onToggleSelect(session.id)}
            onClick={(e) => e.stopPropagation()}
          />
        )}
        <div style={{ flex: 1, minWidth: 0, paddingRight: isBatchMode ? '0' : '32px' }}>
          <div className='session-title' style={{ marginBottom: '4px' }}>
            <span className='material-symbols-outlined' style={{ color: isActive ? '#3b82f6' : '#9ca3af' }}>
              chat_bubble
            </span>
            <span className='session-title-text' style={{ fontWeight: 500 }}>
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
          <Tooltip title={timeDisplay.full}>
            <div style={{ fontSize: '11px', color: '#9ca3af' }}>
              {timeDisplay.relative}
            </div>
          </Tooltip>
          <div style={{ fontSize: '10px', color: '#d1d5db', marginTop: '2px', fontFamily: 'monospace' }}>
            ID: {session.id.slice(0, 8)}...
          </div>
        </div>
      </div>

      {!isBatchMode && (
        <Popconfirm
          title={t('common.deleteSession')}
          description={t('common.deleteSessionConfirm')}
          onConfirm={() => onDelete(session.id)}
          okText={t('common.confirm')}
          cancelText={t('common.cancel')}
          okButtonProps={{ danger: true }}
        >
          <Button
            type='text'
            size='small'
            className='delete-session-btn'
            onClick={(e) => {
              e.stopPropagation()
            }}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              padding: 0
            }}
          >
            <span className='material-symbols-outlined' style={{ fontSize: 18, display: 'block', lineHeight: 1 }}>
              delete
            </span>
          </Button>
        </Popconfirm>
      )}
    </List.Item>
  )
}
