import { useAtomValue } from 'jotai'
import { useCallback } from 'react'
import { matchPath, useLocation, useNavigate } from 'react-router-dom'

import type { Session } from '@vibe-forge/core'

import { sidebarWidthAtom } from '#~/store'

const SESSION_ROUTE_PATTERN = '/session/:sessionId'

export function useSidebarNavigation() {
  const navigate = useNavigate()
  const location = useLocation()
  const sidebarWidth = useAtomValue(sidebarWidthAtom)
  const sessionMatch = matchPath({ path: SESSION_ROUTE_PATTERN, end: true }, location.pathname)
  const activeSessionId = sessionMatch?.params.sessionId
  const showSidebar = location.pathname === '/' || activeSessionId != null

  const getNavigationTarget = useCallback((pathname: string) => ({
    pathname,
    search: location.search
  }), [location.search])

  const handleSelectSession = useCallback((session: Session, _isNew?: boolean) => {
    void navigate(getNavigationTarget(session.id === '' ? '/' : `/session/${session.id}`))
  }, [getNavigationTarget, navigate])

  const handleDeletedSession = useCallback((deletedId: string, nextId?: string) => {
    if (activeSessionId !== deletedId) return
    void navigate(getNavigationTarget(nextId ? `/session/${nextId}` : '/'))
  }, [activeSessionId, getNavigationTarget, navigate])

  return {
    activeSessionId,
    handleDeletedSession,
    handleSelectSession,
    showSidebar,
    sidebarWidth
  }
}
