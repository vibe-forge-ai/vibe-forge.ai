import './Sidebar.scss'

import { Button } from 'antd'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import type { Session } from '@vibe-forge/core'
import { createSession, deleteSession, updateSession } from '../api'
import { SessionList } from './sidebar/SessionList'
import { SidebarHeader } from './sidebar/SidebarHeader'

export function Sidebar({
  activeId,
  onSelectSession,
  onDeletedSession,
  width,
  collapsed,
  onToggleCollapse
}: {
  activeId?: string
  onSelectSession: (session: Session, isNew?: boolean) => void
  onDeletedSession?: (id: string) => void
  width: number
  collapsed: boolean
  onToggleCollapse: () => void
}) {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const { data: sessionsRes, mutate: mutateSessions } = useSWR<{ sessions: Session[] }>(
    `/api/sessions`
  )
  const sessions: Session[] = sessionsRes?.sessions ?? []

  const filteredSessions = useMemo(() => {
    if (searchQuery.trim() === '') return sessions
    const query = searchQuery.toLowerCase()
    return sessions.filter(s =>
      (s.title ?? '').toLowerCase().includes(query)
      || (s.lastMessage ?? '').toLowerCase().includes(query)
      || s.id.toLowerCase().includes(query)
      || s.tags?.some(tag => tag.toLowerCase().includes(query))
    )
  }, [sessions, searchQuery])

  async function handleCreateSession() {
    const res = await createSession()
    const session = res?.session
    await mutateSessions()
    if (session != null) {
      onSelectSession(session, true)
    }
  }

  async function handleArchiveSession(id: string) {
    try {
      await updateSession(id, { isArchived: true })
      await mutateSessions()
      onDeletedSession?.(id)
    } catch (err) {
      console.error('Failed to archive session:', err)
    }
  }

  async function handleStarSession(id: string, isStarred: boolean) {
    try {
      await updateSession(id, { isStarred })
      await mutateSessions()
    } catch (err) {
      console.error('Failed to star session:', err)
    }
  }

  async function handleUpdateTags(id: string, tags: string[]) {
    try {
      await updateSession(id, { tags })
      await mutateSessions()
    } catch (err) {
      console.error('Failed to update tags:', err)
    }
  }

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleBatchDelete = async () => {
    try {
      await Promise.all(Array.from(selectedIds).map(async id => deleteSession(id)))
      await mutateSessions()
      selectedIds.forEach(id => {
        if (activeId === id) onDeletedSession?.(id)
      })
      setSelectedIds(new Set())
      setIsBatchMode(false)
    } catch (err) {
      console.error('Failed to batch delete sessions:', err)
    }
  }

  const toggleBatchMode = () => {
    setIsBatchMode(prev => !prev)
    setSelectedIds(new Set())
  }

  return (
    <div
      className={`sidebar-container ${collapsed ? 'collapsed' : ''}`}
      style={{
        width: collapsed ? 0 : width,
        minWidth: collapsed ? 0 : undefined,
        overflow: 'hidden',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        height: '100%',
        borderRight: collapsed ? 'none' : '1px solid #f0f0f0',
        backgroundColor: '#fff',
        position: 'relative',
        flexShrink: 0
      }}
    >
      <div
        style={{
          width,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: collapsed ? `translateX(-${width}px)` : 'translateX(0)'
        }}
      >
        <SidebarHeader
          onCreateSession={() => {
            void handleCreateSession()
          }}
          onToggleCollapse={onToggleCollapse}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isBatchMode={isBatchMode}
          onToggleBatchMode={toggleBatchMode}
          selectedCount={selectedIds.size}
          onBatchDelete={() => {
            void handleBatchDelete()
          }}
        />
        <SessionList
          sessions={filteredSessions}
          activeId={activeId}
          isBatchMode={isBatchMode}
          selectedIds={selectedIds}
          onSelectSession={onSelectSession}
          onArchiveSession={handleArchiveSession}
          onStarSession={handleStarSession}
          onUpdateTags={handleUpdateTags}
          onToggleSelect={handleToggleSelect}
        />
      </div>
    </div>
  )
}
