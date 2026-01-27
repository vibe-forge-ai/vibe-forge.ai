import './SessionList.scss'

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
  searchQuery?: string
  onSelectSession: (session: Session) => void
  onArchiveSession: (id: string) => void | Promise<void>
  onDeleteSession: (id: string) => void | Promise<void>
  onStarSession: (id: string, isStarred: boolean) => void | Promise<void>
  onUpdateTags: (id: string, tags: string[]) => void | Promise<void>
  onToggleSelect: (id: string) => void
}

export function SessionList({
  sessions,
  activeId,
  isBatchMode,
  selectedIds,
  searchQuery,
  onSelectSession,
  onArchiveSession,
  onDeleteSession,
  onStarSession,
  onUpdateTags,
  onToggleSelect
}: SessionListProps) {
  const { t } = useTranslation()
  return (
    <div className='session-list-container'>
      <div className='session-list-scroll'>
        <List
          className='session-list'
          size='small'
          locale={{
            emptyText: <div className='empty-text'>
              {searchQuery ? t('common.noSessions') : t('common.startNewChat')}
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
              onDelete={onDeleteSession}
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
