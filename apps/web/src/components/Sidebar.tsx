import './Sidebar.scss'

import { Button, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import type { Session } from '@vibe-forge/core'
import { createSession, deleteSession } from '../api'
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
  const { t, i18n } = useTranslation()
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
      || s.id.toLowerCase().includes(query)
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

  async function handleDeleteSession(id: string) {
    try {
      await deleteSession(id)
      await mutateSessions()
      onDeletedSession?.(id)
    } catch (err) {
      console.error('Failed to delete session:', err)
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

  const langItems: MenuProps['items'] = [
    {
      key: 'zh',
      label: '简体中文',
      onClick: () => {
        void i18n.changeLanguage('zh')
      }
    },
    {
      key: 'en',
      label: 'English',
      onClick: () => {
        void i18n.changeLanguage('en')
      }
    }
  ]

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
          onDeleteSession={(id) => {
            void handleDeleteSession(id)
          }}
          onToggleSelect={handleToggleSelect}
        />
        <div className='sidebar-footer'>
          <Dropdown menu={{ items: langItems }} placement='topRight' trigger={['click']}>
            <Button
              type='text'
              icon={
                <span
                  className='material-symbols-outlined'
                  style={{ fontSize: 18, lineHeight: '18px', display: 'block' }}
                >
                  language
                </span>
              }
              style={{
                height: 32,
                width: 32,
                padding: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6b7280',
                borderRadius: 4,
                margin: '8px'
              }}
            />
          </Dropdown>
        </div>
      </div>
    </div>
  )
}
