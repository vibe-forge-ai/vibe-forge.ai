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
import { isSidebarResizingAtom, sidebarWidthAtom, themeAtom } from './store/index'

const MIN_SIDEBAR_WIDTH = 200
const MAX_SIDEBAR_WIDTH = 600

function ChatView() {
  const { t } = useTranslation()
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { data: sessionsRes } = useSWR<{ sessions: Session[] }>('/api/sessions')
  const sessions = sessionsRes?.sessions ?? []
  const session = sessions.find(s => s.id === sessionId)

  if (session == null) {
    return (
      <div style={{ height: '100%', display: 'grid', placeItems: 'center', alignContent: 'center', gap: '16px' }}>
        <Empty description={t('common.sessionNotFound')} />
        <Button type='primary' onClick={() => navigate('/')}>{t('common.backToHome')}</Button>
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

  const { data: sessionsRes } = useSWR<{ sessions: Session[] }>('/api/sessions')

  const [sidebarWidth, setSidebarWidth] = useAtom(sidebarWidthAtom)
  const isResizing = useAtomValue(isSidebarResizingAtom)
  const setIsResizing = useSetAtom(isSidebarResizingAtom)

  const currentPath = location.pathname
  const activeId = currentPath === '/' ? undefined : currentPath.split('/session/')[1]

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

  const isDarkMode = themeMode === 'dark' ||
    (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const showSidebar = currentPath === '/' || currentPath.startsWith('/session/')

  const handleDeletedSession = useCallback((deletedId: string, nextId?: string) => {
    // 如果删除的不是当前激活的会话，不需要跳转
    if (activeId !== deletedId) return

    if (nextId) {
      void navigate(`/session/${nextId}`)
    } else {
      void navigate('/')
    }
  }, [activeId, navigate])

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
        <NavRail />
        {showSidebar && (
          <>
            <Sidebar
              width={sidebarWidth}
              activeId={activeId}
              onSelectSession={(session: Session, isNew?: boolean) => {
                if (session.id === '') {
                  void navigate('/')
                } else {
                  void navigate(`/session/${session.id}`)
                }
              }}
              onDeletedSession={handleDeletedSession}
            />
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
              element={<Chat />}
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
