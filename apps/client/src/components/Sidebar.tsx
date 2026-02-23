import './Sidebar.scss'

import { Button, Tooltip } from 'antd'
import { useAtom, useAtomValue } from 'jotai'
import React, { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import type { Session } from '@vibe-forge/core'
import { useQueryParams } from '#~/hooks/useQueryParams.js'
import { deleteSession, updateSession } from '../api'
import { useGlobalShortcut } from '../hooks/useGlobalShortcut'
import { isSidebarCollapsedAtom, isSidebarResizingAtom } from '../store/index'
import { formatShortcutLabel } from '../utils/shortcutUtils'
import { SessionList } from './sidebar/SessionList'
import { SidebarHeader } from './sidebar/SidebarHeader'

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
  const { t } = useTranslation()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useAtom(isSidebarCollapsedAtom)
  const isResizing = useAtomValue(isSidebarResizingAtom)
  const [searchQuery, setSearchQuery] = useState('')
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set<string>())
  const isMac = navigator.platform.includes('Mac')
  const { values } = useQueryParams<{ tag: string }>({
    keys: ['tag'],
    defaults: { tag: '' },
    omit: { tag: (value) => value === '' }
  })
  const tagFilter = values.tag.trim()

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

  const filteredSessions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return sessions.filter((s: Session) => {
      if (tagFilter) {
        const matchesTag = (s.tags ?? []).some((tag) => tag.toLowerCase() === tagFilter.toLowerCase())
        if (!matchesTag) return false
      }
      if (!query) return true
      return (
        (s.title ?? '').toLowerCase().includes(query) ||
        (s.lastMessage ?? '').toLowerCase().includes(query) ||
        (s.lastUserMessage ?? '').toLowerCase().includes(query) ||
        s.id.toLowerCase().includes(query) ||
        (s.tags ?? []).some((tag: string) => tag.toLowerCase().includes(query))
      )
    })
  }, [sessions, searchQuery, tagFilter])

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
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isBatchMode={isBatchMode}
          onToggleBatchMode={toggleBatchMode}
          selectedCount={selectedIds.size}
          totalCount={filteredSessions.length}
          onSelectAll={handleSelectAll}
          onBatchArchive={() => {
            void handleBatchArchive()
          }}
          isCreatingSession={isCreatingSession}
          onCreateSession={() => {
            void handleCreateSession()
          }}
        />
        <div className='sidebar-new-chat'>
          <Tooltip title={isCreatingSession ? t('common.alreadyInNewChat') : undefined} placement='right'>
            <Button
              ref={createBtnRef}
              className={`new-chat-btn ${isCreatingSession ? 'active' : ''}`}
              type={isCreatingSession ? 'default' : 'primary'}
              block
              disabled={!!isCreatingSession}
              onClick={() => {
                void handleCreateSession()
              }}
            >
              <span className='btn-content'>
                <span className={`material-symbols-rounded ${isCreatingSession ? 'filled' : ''}`}>
                  {isCreatingSession ? 'chat_bubble' : 'send'}
                </span>
                <span>{isCreatingSession ? t('common.creatingChat') : t('common.newChat')}</span>
              </span>
              <span className='shortcut-tag'>
                {shortcutLabel}
              </span>
            </Button>
          </Tooltip>
        </div>
        <SessionList
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
