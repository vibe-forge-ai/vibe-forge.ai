import { Button, Empty, Layout } from 'antd'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import useSWR from 'swr'

import { ArchiveView } from '#~/components/ArchiveView'
import { Chat } from '#~/components/Chat'
import { NavRail } from '#~/components/NavRail'
import { SearchView } from '#~/components/SearchView'
import { Sidebar } from '#~/components/Sidebar'
import type { Session } from '@vibe-forge/core'

const MIN_SIDEBAR_WIDTH = 200
const MAX_SIDEBAR_WIDTH = 600
const DEFAULT_SIDEBAR_WIDTH = 300

function ChatView({ renderLeftHeader }: { renderLeftHeader?: React.ReactNode }) {
  const { t } = useTranslation()
  const { sessionId } = useParams()
  const { data: sessionsRes } = useSWR<{ sessions: Session[] }>('/api/sessions')
  const sessions = sessionsRes?.sessions ?? []
  const session = sessions.find(s => s.id === sessionId)

  if (session == null) {
    return (
      <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
        <Empty description={t('common.sessionNotFound')} />
      </div>
    )
  }

  return <Chat session={session} renderLeftHeader={renderLeftHeader} />
}

export default function App() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebarWidth')
    return saved != null ? Number.parseInt(saved, 10) : DEFAULT_SIDEBAR_WIDTH
  })
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebarCollapsed') === 'true'
  })
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  const currentPath = location.pathname
  const activeId = currentPath.split('/session/')[1]

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true)
    e.preventDefault()
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return

    let newWidth = e.clientX
    if (newWidth < MIN_SIDEBAR_WIDTH) newWidth = MIN_SIDEBAR_WIDTH
    if (newWidth > MAX_SIDEBAR_WIDTH) newWidth = MAX_SIDEBAR_WIDTH

    setSidebarWidth(newWidth)
    localStorage.setItem('sidebarWidth', newWidth.toString())
  }, [isResizing])

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
  }, [])

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
    } else {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const newState = !prev
      localStorage.setItem('sidebarCollapsed', newState.toString())
      return newState
    })
  }

  const toggleButton = (
    <Button
      type='text'
      size='small'
      onClick={toggleSidebar}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '24px',
        height: '24px',
        padding: 0,
        color: '#6b7280',
        backgroundColor: 'transparent',
        border: '1px solid #e5e7eb',
        borderRadius: '4px'
      }}
      title={t('common.expand')}
    >
      <span
        className='material-symbols-outlined'
        style={{ fontSize: 18, display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}
      >
        side_navigation
      </span>
    </Button>
  )

  const showSidebar = currentPath === '/' || currentPath.startsWith('/session/')

  return (
    <Layout style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', height: '100%', width: '100%' }}>
        <NavRail />
        {showSidebar && (
          <>
            <Sidebar
              width={sidebarWidth}
              collapsed={isSidebarCollapsed}
              activeId={activeId}
              onSelectSession={(s: Session, isNew?: boolean) => {
                void navigate(`/session/${encodeURIComponent(s.id)}`, { state: { isNew } })
              }}
              onDeletedSession={(id: string) => {
                if (activeId === id) {
                  void navigate('/')
                }
              }}
              onToggleCollapse={toggleSidebar}
            />

            <div
              onMouseDown={handleMouseDown}
              style={{
                width: isSidebarCollapsed ? 0 : '4px',
                cursor: isSidebarCollapsed ? 'default' : 'col-resize',
                backgroundColor: isResizing ? '#3b82f6' : 'transparent',
                zIndex: 10,
                transition: 'background-color 0.2s, width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                flexShrink: 0,
                position: 'relative',
                marginLeft: isSidebarCollapsed ? 0 : '-2px',
                marginRight: isSidebarCollapsed ? 0 : '-2px',
                pointerEvents: isSidebarCollapsed ? 'none' : 'auto',
                overflow: 'hidden'
              }}
              title={t('common.dragResize')}
            />
          </>
        )}

        <Layout.Content style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <Routes>
            <Route
              path='/session/:sessionId'
              element={<ChatView renderLeftHeader={isSidebarCollapsed ? toggleButton : null} />}
            />
            <Route path='/archive' element={<ArchiveView />} />
            <Route path='/search' element={<SearchView />} />
            <Route
              path='/'
              element={
                <div style={{ height: '100%', position: 'relative' }}>
                  {isSidebarCollapsed && (
                    <div style={{ position: 'absolute', left: '16px', top: '16px', zIndex: 10 }}>
                      {toggleButton}
                    </div>
                  )}
                  <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
                    <Empty description={t('common.selectOrCreateSession')} />
                  </div>
                </div>
              }
            />
          </Routes>
        </Layout.Content>
      </div>
    </Layout>
  )
}

/* no-op */
