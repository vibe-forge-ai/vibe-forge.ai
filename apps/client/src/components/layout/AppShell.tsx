import './AppShell.scss'

import { Layout } from 'antd'
import { useAtom, useSetAtom } from 'jotai'
import { useEffect, useMemo, useRef } from 'react'
import type { PropsWithChildren } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'

import type { Session } from '@vibe-forge/core'

import { NavRail } from '#~/components/NavRail'
import { Sidebar } from '#~/components/Sidebar'
import { useResponsiveLayout } from '#~/hooks/use-responsive-layout'
import { useSidebarQueryState } from '#~/hooks/use-sidebar-query-state'
import { isMobileSidebarOpenAtom, isSidebarCollapsedAtom } from '#~/store/index'
import { useMobileSidebarModal } from './@hooks/use-mobile-sidebar-modal'
import { MOBILE_SIDEBAR_DIALOG_ID } from './mobile-sidebar-constants'

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
  const { t } = useTranslation()
  const { isSidebarCollapsed } = useSidebarQueryState()
  const location = useLocation()
  const { isCompactLayout } = useResponsiveLayout()
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useAtom(isMobileSidebarOpenAtom)
  const setIsSidebarCollapsed = useSetAtom(isSidebarCollapsedAtom)
  const isDesktopSidebarCollapsed = !isCompactLayout && isSidebarCollapsed
  const contentRegionRef = useRef<HTMLDivElement | null>(null)
  const mobileNavRegionRef = useRef<HTMLDivElement | null>(null)
  const mobileSidebarSheetRef = useRef<HTMLDivElement | null>(null)
  const mobileSidebarBackgroundRefs = useMemo(
    () => [contentRegionRef, mobileNavRegionRef],
    []
  )

  useEffect(() => {
    setIsSidebarCollapsed(isCompactLayout ? false : isSidebarCollapsed)
  }, [isCompactLayout, isSidebarCollapsed, setIsSidebarCollapsed])

  useEffect(() => {
    setIsMobileSidebarOpen(false)
  }, [isCompactLayout, location.pathname, setIsMobileSidebarOpen])

  useEffect(() => {
    if (!isCompactLayout || showSidebar) {
      return
    }

    setIsMobileSidebarOpen(false)
  }, [isCompactLayout, setIsMobileSidebarOpen, showSidebar])

  useMobileSidebarModal({
    backgroundRefs: mobileSidebarBackgroundRefs,
    isCompactLayout,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
    sheetRef: mobileSidebarSheetRef
  })

  const resolvedSidebarWidth = isCompactLayout ? Math.min(sidebarWidth, 320) : sidebarWidth
  const contentClassName = [
    'app-shell__content',
    showSidebar ? 'app-shell__content--session' : '',
    isDesktopSidebarCollapsed ? 'is-sidebar-collapsed' : '',
    showSidebar ? '' : 'is-flat'
  ].filter(Boolean).join(' ')
  const content = (
    <div
      ref={contentRegionRef}
      className='app-shell__content-region'
      aria-hidden={isCompactLayout && isMobileSidebarOpen ? true : undefined}
    >
      <Layout.Content className={contentClassName}>
        {children}
      </Layout.Content>
    </div>
  )

  if (isCompactLayout) {
    return (
      <Layout className={`app-shell app-shell--compact ${isDarkMode ? 'app-shell--dark' : ''}`}>
        {content}

        {showSidebar && (
          <>
            <button
              type='button'
              className={`app-shell__mobile-sidebar-backdrop ${isMobileSidebarOpen ? 'is-open' : ''}`}
              aria-label={t('common.close')}
              aria-hidden={!isMobileSidebarOpen}
              tabIndex={-1}
              onClick={() => setIsMobileSidebarOpen(false)}
            />
            <div
              ref={mobileSidebarSheetRef}
              id={MOBILE_SIDEBAR_DIALOG_ID}
              className={`app-shell__mobile-sidebar-sheet ${isMobileSidebarOpen ? 'is-open' : ''}`}
              role='dialog'
              aria-modal={isMobileSidebarOpen ? 'true' : undefined}
              aria-label={t('common.sessions')}
              aria-hidden={!isMobileSidebarOpen}
              tabIndex={-1}
            >
              <Sidebar
                width={resolvedSidebarWidth}
                activeId={activeSessionId}
                onSelectSession={(session, isNew) => {
                  setIsMobileSidebarOpen(false)
                  onSelectSession(session, isNew)
                }}
                onDeletedSession={(deletedId, nextId) => {
                  setIsMobileSidebarOpen(false)
                  onDeletedSession(deletedId, nextId)
                }}
                isCompactLayout
                isMobileOpen={isMobileSidebarOpen}
                onRequestClose={() => setIsMobileSidebarOpen(false)}
              />
            </div>
          </>
        )}

        <div ref={mobileNavRegionRef}>
          <NavRail
            isCompactLayout
            ariaHidden={isMobileSidebarOpen}
            showSidebar={showSidebar}
            onOpenSidebar={() => setIsMobileSidebarOpen(true)}
          />
        </div>
      </Layout>
    )
  }

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
      {content}
    </Layout>
  )
}
