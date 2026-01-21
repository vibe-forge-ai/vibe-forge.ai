import './Sidebar.scss'

import { Button } from 'antd'
import { useAtomValue } from 'jotai'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import type { Session } from '@vibe-forge/core'
import { createSession, deleteSession, updateSession } from '../api'
import { isSidebarResizingAtom } from '../store/index'
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
  const isResizing = useAtomValue(isSidebarResizingAtom)
  const [searchQuery, setSearchQuery] = useState('')
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set<string>())

  const { data: sessionsRes, mutate: mutateSessions } = useSWR<{ sessions: Session[] }>(
    `/api/sessions`
  )
  const sessions: Session[] = sessionsRes?.sessions ?? []

  const filteredSessions = useMemo(() => {
    if (searchQuery.trim() === '') return sessions
    const query = searchQuery.toLowerCase()
    return sessions.filter((s: Session) =>
      (s.title ?? '').toLowerCase().includes(query)
      || (s.lastMessage ?? '').toLowerCase().includes(query)
      || (s.lastUserMessage ?? '').toLowerCase().includes(query)
      || s.id.toLowerCase().includes(query)
      || (s.tags ?? []).some((tag: string) => tag.toLowerCase().includes(query))
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

  async function handleDeleteSession(id: string) {
    try {
      await deleteSession(id)
      await mutateSessions()
      if (activeId === id) onDeletedSession?.(id)
    } catch (err) {
      console.error('Failed to delete session:', err)
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
    setSelectedIds((prev: Set<string>) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(filteredSessions.map(s => s.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleBatchDelete = async () => {
    try {
      await Promise.all(Array.from(selectedIds).map(async (id: string) => deleteSession(id)))
      await mutateSessions()
      selectedIds.forEach((id: string) => {
        if (activeId === id) onDeletedSession?.(id)
      })
      setSelectedIds(new Set<string>())
      setIsBatchMode(false)
    } catch (err) {
      console.error('Failed to batch delete sessions:', err)
    }
  }

  const toggleBatchMode = () => {
    setIsBatchMode((prev: boolean) => !prev)
    setSelectedIds(new Set<string>())
  }

  return (
    <div
      className={`sidebar-container ${collapsed ? 'collapsed' : ''}`}
      style={{
        width: collapsed ? 0 : width,
        minWidth: collapsed ? 0 : undefined,
        transition: isResizing ? 'none' : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        height: '100%',
        borderRight: collapsed ? 'none' : '1px solid var(--border-color)',
        backgroundColor: 'var(--sidebar-bg)',
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
          transition: isResizing ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: collapsed ? `translateX(-${width}px)` : 'translateX(0)'
        }}
      >
        <SidebarHeader
          onCreateSession={() => {
            void handleCreateSession()
          }}
          onToggleCollapse={onToggleCollapse}
          isCollapsed={collapsed}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isBatchMode={isBatchMode}
          onToggleBatchMode={toggleBatchMode}
          selectedCount={selectedIds.size}
          totalCount={filteredSessions.length}
          onSelectAll={handleSelectAll}
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
          onDeleteSession={handleDeleteSession}
          onStarSession={handleStarSession}
          onUpdateTags={handleUpdateTags}
          onToggleSelect={handleToggleSelect}
        />
      </div>
    </div>
  )
}
