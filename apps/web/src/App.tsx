import { Button, ConfigProvider, Empty, Layout, theme } from 'antd'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import React, { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import useSWR from 'swr'

import { ArchiveView } from '#~/components/ArchiveView'
import { Chat } from '#~/components/Chat'
import { NavRail } from '#~/components/NavRail'
import { SearchView } from '#~/components/SearchView'
import { Sidebar } from '#~/components/Sidebar'
import type { Session } from '@vibe-forge/core'
import { isSidebarCollapsedAtom, isSidebarResizingAtom, sidebarWidthAtom, themeAtom } from './store/index'

const MIN_SIDEBAR_WIDTH = 200
const MAX_SIDEBAR_WIDTH = 600

function ChatView() {
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

  return <Chat session={session} />
}

export default function App() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [themeMode] = useAtom(themeAtom)

  const [sidebarWidth, setSidebarWidth] = useAtom(sidebarWidthAtom)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useAtom(isSidebarCollapsedAtom)
  const isResizing = useAtomValue(isSidebarResizingAtom)
  const setIsResizing = useSetAtom(isSidebarResizingAtom)

  const currentPath = location.pathname
  const activeId = currentPath.split('/session/')[1]

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true)
    e.preventDefault()
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return

    // 获取相对于容器左边缘的坐标
    // 容器由 NavRail (56px) + Sidebar 组成
    let newWidth = e.clientX - 56
    if (newWidth < MIN_SIDEBAR_WIDTH) newWidth = MIN_SIDEBAR_WIDTH
    if (newWidth > MAX_SIDEBAR_WIDTH) newWidth = MAX_SIDEBAR_WIDTH

    setSidebarWidth(newWidth)
  }, [isResizing, setSidebarWidth])

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
    localStorage.setItem('sidebarWidth', sidebarWidth.toString())
  }, [sidebarWidth])

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
    setIsSidebarCollapsed((prev: boolean) => {
      const newState = !prev
      localStorage.setItem('sidebarCollapsed', newState.toString())
      return newState
    })
  }

  const isDarkMode = themeMode === 'dark'
    || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const showSidebar = currentPath === '/' || currentPath.startsWith('/session/')

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  return (
    <ConfigProvider
      theme={{
        algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: isDarkMode ? '#3b82f6' : '#000000'
        }
      }}
    >
      <Layout style={{ height: '100vh', display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
        <NavRail collapsed={isSidebarCollapsed} onToggleCollapse={toggleSidebar} />
        {showSidebar && (
          <>
            <Sidebar
              width={sidebarWidth}
              collapsed={isSidebarCollapsed}
              onToggleCollapse={toggleSidebar}
              activeId={activeId}
              onSelectSession={(session: Session) => {
                void navigate(`/session/${session.id}`)
              }}
            />
            {!isSidebarCollapsed && (
              <div
                onMouseDown={handleMouseDown}
                style={{
                  width: '4px',
                  cursor: 'col-resize',
                  backgroundColor: isResizing ? '#2563eb' : 'transparent',
                  transition: 'background-color 0.2s',
                  zIndex: 10,
                  flexShrink: 0
                }}
              />
            )}
          </>
        )}
        <Layout.Content
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: isDarkMode ? '#141414' : '#fff'
          }}
        >
          <Routes>
            <Route
              path='/'
              element={
                <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#6b7280' }}>
                  {t('common.selectOrCreateSession')}
                </div>
              }
            />
            <Route path='/session/:sessionId' element={<ChatView />} />
            <Route path='/archive' element={<ArchiveView />} />
            <Route path='/search' element={<SearchView />} />
          </Routes>
        </Layout.Content>
      </Layout>
    </ConfigProvider>
  )
}
