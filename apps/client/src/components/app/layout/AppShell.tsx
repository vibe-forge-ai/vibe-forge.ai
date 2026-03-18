import './AppShell.scss'

import { Layout } from 'antd'
import type { PropsWithChildren } from 'react'

import type { Session } from '@vibe-forge/core'

import { NavRail } from '#~/components/NavRail'
import { Sidebar } from '#~/components/Sidebar'

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
  return (
    <Layout className={`app-shell ${isDarkMode ? 'app-shell--dark' : ''}`}>
      <NavRail />
      {showSidebar && (
        <Sidebar
          width={sidebarWidth}
          activeId={activeSessionId}
          onSelectSession={onSelectSession}
          onDeletedSession={onDeletedSession}
        />
      )}
      <Layout.Content className='app-shell__content'>
        {children}
      </Layout.Content>
    </Layout>
  )
}
