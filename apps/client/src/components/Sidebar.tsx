import './Sidebar.scss'

import { useAtomValue } from 'jotai'
import React, { useMemo, useRef, useState } from 'react'
import useSWR from 'swr'

import { useSidebarQueryState } from '#~/hooks/use-sidebar-query-state'
import { getAdapterDisplay } from '#~/resources/adapters.js'
import type { Session } from '@vibe-forge/core'
import { deleteSession, updateSession } from '../api'
import { useGlobalShortcut } from '../hooks/useGlobalShortcut'
import { isSidebarResizingAtom } from '../store/index'
import { formatShortcutLabel } from '../utils/shortcutUtils'
import { SessionList } from './sidebar/SessionList'
import { SidebarHeader } from './sidebar/SidebarHeader'
import { matchesAnyFilterPattern } from './sidebar/filter-utils'

export function Sidebar({
  activeId,
  onSelectSession,
  onDeletedSession,
  width
}: {
  activeId?: string
  onSelectSession: (session: Session, isNew?: boolean) => void
  onDeletedSession?: (id: string, nextId?: string) => void
  width: number
}) {
  const {
    adapterFilters,
    hasActiveFilterConditions,
    isSidebarCollapsed,
    searchQuery,
    setAdapterFilters,
    setSearchQuery,
    setSidebarCollapsed,
    setTagFilters,
    tagFilters
  } = useSidebarQueryState()
  const isResizing = useAtomValue(isSidebarResizingAtom)
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set<string>())
  const isMac = navigator.platform.includes('Mac')

  const { data: sessionsRes, mutate: mutateSessions } = useSWR<{ sessions: Session[] }>(
    `/api/sessions`
  )
  const sessions: Session[] = sessionsRes?.sessions ?? []
  const { data: configRes } = useSWR<{
    sources?: {
      merged?: {
        shortcuts?: {
          newSession?: string
        }
      }
    }
  }>('/api/config')

  const newSessionShortcut = configRes?.sources?.merged?.shortcuts?.newSession
  const resolvedNewSessionShortcut = newSessionShortcut != null && newSessionShortcut.trim() !== ''
    ? newSessionShortcut
    : 'mod+k'
  const shortcutLabel = useMemo(
    () => formatShortcutLabel(resolvedNewSessionShortcut, isMac),
    [resolvedNewSessionShortcut, isMac]
  )
  const availableTags = useMemo(() => {
    return Array.from(
      new Set(
        sessions.flatMap((session) => (session.tags ?? []).map((tag) => tag.trim()).filter(Boolean))
      )
    ).sort((left, right) => left.localeCompare(right))
  }, [sessions])
  const availableAdapters = useMemo(() => {
    return Array.from(
      new Set(
        sessions
          .map((session) => session.adapter?.trim() ?? '')
          .filter(Boolean)
      )
    ).sort((left, right) => left.localeCompare(right))
  }, [sessions])

  const filteredSessions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return sessions.filter((s: Session) => {
      if (!matchesAnyFilterPattern(s.tags ?? [], tagFilters)) return false

      const adapterCandidates = [
        s.adapter ?? '',
        s.adapter != null && s.adapter !== '' ? getAdapterDisplay(s.adapter).title : ''
      ].filter(Boolean)
      if (!matchesAnyFilterPattern(adapterCandidates, adapterFilters)) return false

      if (!query) return true
      return (
        (s.title ?? '').toLowerCase().includes(query) ||
        (s.lastMessage ?? '').toLowerCase().includes(query) ||
        (s.lastUserMessage ?? '').toLowerCase().includes(query) ||
        s.id.toLowerCase().includes(query) ||
        (s.tags ?? []).some((tag: string) => tag.toLowerCase().includes(query)) ||
        adapterCandidates.some((candidate) => candidate.toLowerCase().includes(query))
      )
    })
  }, [adapterFilters, searchQuery, sessions, tagFilters])

  async function handleCreateSession() {
    onSelectSession({ id: '' } as Session, true)
  }

  async function handleArchiveSession(id: string) {
    // 先计算下一个要跳转的 ID
    let nextId: string | undefined
    const currentIndex = sessions.findIndex(s => s.id === id)
    if (currentIndex !== -1) {
      if (currentIndex + 1 < sessions.length) {
        nextId = sessions[currentIndex + 1].id
      } else if (currentIndex - 1 >= 0) {
        nextId = sessions[currentIndex - 1].id
      }
    }

    try {
      await updateSession(id, { isArchived: true })
      await mutateSessions()
      // 传递 nextId 给 onDeletedSession
      onDeletedSession?.(id, nextId)
    } catch (err) {
      console.error('Failed to archive session:', err)
    }
  }

  async function handleDeleteSession(id: string) {
    // 先计算下一个要跳转的 ID
    let nextId: string | undefined
    const currentIndex = sessions.findIndex(s => s.id === id)
    if (currentIndex !== -1) {
      if (currentIndex + 1 < sessions.length) {
        nextId = sessions[currentIndex + 1].id
      } else if (currentIndex - 1 >= 0) {
        nextId = sessions[currentIndex - 1].id
      }
    }

    try {
      await deleteSession(id)
      await mutateSessions()
      if (activeId === id) onDeletedSession?.(id, nextId)
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

  const handleBatchArchive = async () => {
    try {
      await Promise.all(Array.from(selectedIds).map(async (id: string) => updateSession(id, { isArchived: true })))
      await mutateSessions()

      // Calculate nextId if active session is archived
      if (activeId && selectedIds.has(activeId)) {
        let nextId: string | undefined
        // Find the first session that is NOT in the selectedIds list
        const nextSession = sessions.find(s => !selectedIds.has(s.id))
        if (nextSession) {
          nextId = nextSession.id
        }
        onDeletedSession?.(activeId, nextId)
      }

      setSelectedIds(new Set<string>())
      setIsBatchMode(false)
    } catch (err) {
      console.error('Failed to batch archive sessions:', err)
    }
  }

  const handleBatchDelete = async () => {
    try {
      await Promise.all(Array.from(selectedIds).map(async (id: string) => deleteSession(id)))
      await mutateSessions()

      if (activeId && selectedIds.has(activeId)) {
        const nextSession = sessions.find(s => !selectedIds.has(s.id))
        onDeletedSession?.(activeId, nextSession?.id)
      }

      setSelectedIds(new Set<string>())
      setIsBatchMode(false)
    } catch (err) {
      console.error('Failed to batch delete sessions:', err)
    }
  }

  const handleBatchStar = async (isStarred: boolean) => {
    try {
      await Promise.all(Array.from(selectedIds).map(async (id: string) => updateSession(id, { isStarred })))
      await mutateSessions()
    } catch (err) {
      console.error('Failed to batch update star status:', err)
    }
  }

  const toggleBatchMode = () => {
    setIsBatchMode((prev: boolean) => !prev)
    setSelectedIds(new Set<string>())
  }

  const isCreatingSession = activeId === undefined || activeId === ''

  const createBtnRef = useRef<HTMLButtonElement>(null)

  useGlobalShortcut({
    shortcut: resolvedNewSessionShortcut,
    isMac,
    onTrigger: (event) => {
      event.preventDefault()
      if (isCreatingSession) return
      if (createBtnRef.current) {
        createBtnRef.current.classList.add('active-scale')
        setTimeout(() => {
          createBtnRef.current?.classList.remove('active-scale')
        }, 200)
      }
      void handleCreateSession()
    }
  })

  return (
    <div
      className={`sidebar-container ${isSidebarCollapsed ? 'collapsed' : ''}`}
      style={{
        width: isSidebarCollapsed ? 0 : width,
        minWidth: isSidebarCollapsed ? 0 : undefined,
        transition: isResizing ? 'none' : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        borderRight: isSidebarCollapsed ? 'none' : undefined
      }}
    >
      <div
        className='sidebar-content'
        style={{
          width,
          transition: isResizing ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isSidebarCollapsed ? `translateX(-${width}px)` : 'translateX(0)'
        }}
      >
        <SidebarHeader
          adapterFilters={adapterFilters}
          availableAdapters={availableAdapters}
          hasActiveFilterConditions={hasActiveFilterConditions}
          isSidebarCollapsed={isSidebarCollapsed}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          availableTags={availableTags}
          tagFilters={tagFilters}
          onAdapterFilterChange={setAdapterFilters}
          onTagFilterChange={setTagFilters}
          isBatchMode={isBatchMode}
          onToggleBatchMode={toggleBatchMode}
          onToggleSidebarCollapsed={() => setSidebarCollapsed(!isSidebarCollapsed)}
          selectedCount={selectedIds.size}
          totalCount={filteredSessions.length}
          onSelectAll={handleSelectAll}
          onBatchArchive={() => {
            void handleBatchArchive()
          }}
          onBatchDelete={() => {
            void handleBatchDelete()
          }}
          onBatchStar={() => {
            void handleBatchStar(true)
          }}
          isCreatingSession={isCreatingSession}
          shortcutLabel={shortcutLabel}
          createButtonRef={createBtnRef}
          onCreateSession={() => {
            void handleCreateSession()
          }}
        />
        <SessionList
          hasActiveFilters={hasActiveFilterConditions}
          sessions={filteredSessions}
          activeId={activeId}
          isBatchMode={isBatchMode}
          selectedIds={selectedIds}
          searchQuery={searchQuery}
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
