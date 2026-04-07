import { useCallback, useEffect } from 'react'

import type { ChatHeaderView } from '#~/components/chat/ChatHeader.js'
import { useQueryParams } from '#~/hooks/useQueryParams.js'

const normalizeView = (value: string): ChatHeaderView => {
  if (value === 'timeline' || value === 'settings' || value === 'history') {
    return value
  }
  return 'history'
}

export function useChatView() {
  const { values: queryValues, update: updateQuery } = useQueryParams<{ terminal: string; view: string }>({
    keys: ['view', 'terminal'],
    defaults: {
      view: 'history',
      terminal: ''
    },
    omit: {
      view: (value) => value === 'history',
      terminal: (value) => value === '' || value === 'false'
    }
  })

  const legacyTerminalView = queryValues.view === 'terminal'
  const activeView = normalizeView(legacyTerminalView ? 'history' : queryValues.view)
  const isTerminalOpen = queryValues.terminal === 'true' || legacyTerminalView

  const setActiveView = useCallback((view: ChatHeaderView) => {
    updateQuery({ view })
  }, [updateQuery])

  const setIsTerminalOpen = useCallback((nextOpen: boolean) => {
    updateQuery({ terminal: nextOpen ? 'true' : 'false' })
  }, [updateQuery])

  useEffect(() => {
    if (activeView !== queryValues.view) {
      updateQuery({ view: activeView })
    }
  }, [activeView, queryValues.view, updateQuery])

  useEffect(() => {
    if (legacyTerminalView) {
      updateQuery({
        view: 'history',
        terminal: 'true'
      })
    }
  }, [legacyTerminalView, updateQuery])

  return {
    activeView,
    isTerminalOpen,
    setActiveView,
    setIsTerminalOpen
  }
}
