import React from 'react'
import { List, Button, Popconfirm } from 'antd'
import { useTranslation } from 'react-i18next'
import type { Session } from '#~/types'
import { SessionItem } from './SessionItem'

interface SessionListProps {
  sessions: Session[]
  activeId?: string
  isBatchMode: boolean
  selectedIds: Set<string>
  onSelectSession: (session: Session) => void
  onDeleteSession: (id: string) => void
  onToggleSelect: (id: string) => void
}

export function SessionList({ 
  sessions, 
  activeId, 
  isBatchMode, 
  selectedIds,
  onSelectSession, 
  onDeleteSession,
  onToggleSelect
}: SessionListProps) {
  const { t } = useTranslation()
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <List
          className="session-list"
          size="small"
          locale={{ emptyText: <div style={{ padding: '20px', color: '#9ca3af', textAlign: 'center' }}>{t('common.noSessions')}</div> }}
          dataSource={sessions}
          renderItem={(s: Session) => (
            <SessionItem
              session={s}
              isActive={activeId === s.id}
              isBatchMode={isBatchMode}
              isSelected={selectedIds.has(s.id)}
              onSelect={onSelectSession}
              onDelete={onDeleteSession}
              onToggleSelect={onToggleSelect}
            />
          )}
        />
      </div>
    </div>
  )
}
