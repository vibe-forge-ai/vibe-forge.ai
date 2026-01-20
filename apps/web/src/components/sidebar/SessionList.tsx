import type { Session } from '@vibe-forge/core'
import { List } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { SessionItem } from './SessionItem'

interface SessionListProps {
  sessions: Session[]
  activeId?: string
  isBatchMode: boolean
  selectedIds: Set<string>
  onSelectSession: (session: Session) => void
  onArchiveSession: (id: string) => void | Promise<void>
  onStarSession: (id: string, isStarred: boolean) => void | Promise<void>
  onUpdateTags: (id: string, tags: string[]) => void | Promise<void>
  onToggleSelect: (id: string) => void
}

export function SessionList({
  sessions,
  activeId,
  isBatchMode,
  selectedIds,
  onSelectSession,
  onArchiveSession,
  onStarSession,
  onUpdateTags,
  onToggleSelect
}: SessionListProps) {
  const { t } = useTranslation()
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <List
          className='session-list'
          size='small'
          locale={{
            emptyText: <div style={{ padding: '20px', color: '#9ca3af', textAlign: 'center' }}>
              {t('common.noSessions')}
            </div>
          }}
          dataSource={sessions}
          renderItem={(s: Session) => (
            <SessionItem
              session={s}
              isActive={activeId === s.id}
              isBatchMode={isBatchMode}
              isSelected={selectedIds.has(s.id)}
              onSelect={onSelectSession}
              onArchive={onArchiveSession}
              onStar={onStarSession}
              onUpdateTags={onUpdateTags}
              onToggleSelect={onToggleSelect}
            />
          )}
        />
      </div>
    </div>
  )
}
