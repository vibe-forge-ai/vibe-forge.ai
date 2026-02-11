import './SessionList.scss'

import type { Session } from '@vibe-forge/core'
import { Button, List } from 'antd'
import React, { useMemo, useState } from 'react'
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
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())

  const { flattenedSessions, childSummaryMap } = useMemo(() => {
    const sessionMap = new Map(sessions.map((s) => [s.id, s]))
    const childrenMap = new Map<string, Session[]>()
    for (const session of sessions) {
      if (session.parentSessionId) {
        const list = childrenMap.get(session.parentSessionId) ?? []
        list.push(session)
        childrenMap.set(session.parentSessionId, list)
      }
    }

    const roots = sessions.filter((s) => {
      if (!s.parentSessionId) return true
      return !sessionMap.has(s.parentSessionId)
    })

    const childSummary = new Map<string, string>()
    for (const [parentId, children] of childrenMap.entries()) {
      const total = children.length
      const statusCount = new Map<string, number>()
      for (const child of children) {
        const status = child.status ?? 'running'
        statusCount.set(status, (statusCount.get(status) ?? 0) + 1)
      }
      const parts = [t('common.childSummary', { count: total })]
      for (const [status, count] of statusCount.entries()) {
        parts.push(t('common.childStatusItem', { count, status: t(`common.status.${status}`) }))
      }
      childSummary.set(parentId, parts.join(' · '))
    }

    const result: Array<{ session: Session; depth: number; hasChildren: boolean }> = []
    const visited = new Set<string>()

    const walk = (session: Session, depth: number) => {
      if (visited.has(session.id)) return
      visited.add(session.id)
      const children = childrenMap.get(session.id) ?? []
      result.push({
        session,
        depth,
        hasChildren: children.length > 0
      })
      if (collapsedIds.has(session.id)) return
      for (const child of children) {
        walk(child, depth + 1)
      }
    }

    for (const root of roots) {
      walk(root, 0)
    }

    return {
      flattenedSessions: result,
      childSummaryMap: childSummary
    }
  }, [sessions, collapsedIds, t])

  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

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
          dataSource={flattenedSessions}
          renderItem={({ session: s, depth, hasChildren }) => (
            <div
              className={`session-row ${depth > 0 ? 'has-parent' : ''}`}
              style={{ '--session-depth': depth } as React.CSSProperties}
            >
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
              {hasChildren && !isBatchMode && (
                <div
                  className='session-collapse-row'
                  style={{ '--session-depth': depth } as React.CSSProperties}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    type='text'
                    size='small'
                    className={`session-tree-toggle ${collapsedIds.has(s.id) ? 'collapsed' : ''}`}
                    onClick={() => toggleCollapse(s.id)}
                    icon={<span className='material-symbols-rounded'>chevron_right</span>}
                  />
                  <span className='session-collapse-label'>
                    {collapsedIds.has(s.id) ? t('common.expandChildren') : t('common.collapseChildren')}
                  </span>
                  <span className='session-collapse-summary'>
                    {childSummaryMap.get(s.id) ?? t('common.childSummary', { count: 0 })}
                  </span>
                </div>
              )}
            </div>
          )}
        />
      </div>
    </div>
  )
}
