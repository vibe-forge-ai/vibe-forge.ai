import React from 'react'
import { Button, List, Popconfirm, Checkbox } from 'antd'
import { useTranslation } from 'react-i18next'
import type { Session } from '#~/types'

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
          <div className="session-title" style={{ marginBottom: '4px' }}>
            <span className="material-symbols-outlined">chat_bubble</span>
            <span style={{ fontWeight: 500 }}>{session.title || t('common.newChat')}</span>
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af' }}>
            {new Date(session.createdAt).toLocaleString(i18n.language === 'zh' ? 'zh-CN' : 'en-US')}
          </div>
          <div style={{ fontSize: '10px', color: '#d1d5db', marginTop: '2px', fontFamily: 'monospace' }}>
            ID: {session.id.slice(0, 12)}...
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
            type="text"
            size="small"
            className="delete-session-btn"
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
              padding: 0,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18, display: 'block', lineHeight: 1 }}>
              delete
            </span>
          </Button>
        </Popconfirm>
      )}
    </List.Item>
  )
}
