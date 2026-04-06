import './AppShell.scss'

import { Layout } from 'antd'
import { useSetAtom } from 'jotai'
import { useEffect } from 'react'
import type { PropsWithChildren } from 'react'

import type { Session } from '@vibe-forge/core'

import { NavRail } from '#~/components/NavRail'
import { Sidebar } from '#~/components/Sidebar'
import { useSidebarQueryState } from '#~/hooks/use-sidebar-query-state'
import { isSidebarCollapsedAtom } from '#~/store/index'

type AppShellProps = PropsWithChildren<{
  activeSessionId?: string
  isDarkMode: boolean
  onDeletedSession: (deletedId: string, nextId?: string) => void
  onSelectSession: (session: Session, isNew?: boolean) => void
  showSidebar: boolean
  sidebarWidth: number
}>

export function AppShell({
  activeSessionId,
  children,
  isDarkMode,
  onDeletedSession,
  onSelectSession,
  showSidebar,
  sidebarWidth
}: AppShellProps) {
  const { isSidebarCollapsed } = useSidebarQueryState()
  const setIsSidebarCollapsed = useSetAtom(isSidebarCollapsedAtom)

  useEffect(() => {
    setIsSidebarCollapsed(isSidebarCollapsed)
  }, [isSidebarCollapsed, setIsSidebarCollapsed])

  return (
    <Layout className={`app-shell ${isDarkMode ? 'app-shell--dark' : ''}`}>
      <div className='app-shell__sidebar-region'>
        <NavRail />
        {showSidebar && (
          <Sidebar
            width={sidebarWidth}
            activeId={activeSessionId}
            onSelectSession={onSelectSession}
            onDeletedSession={onDeletedSession}
          />
        )}
      </div>
      <Layout.Content
        className={`app-shell__content ${isSidebarCollapsed ? 'is-sidebar-collapsed' : ''}`}
      >
        {children}
      </Layout.Content>
    </Layout>
  )
}
