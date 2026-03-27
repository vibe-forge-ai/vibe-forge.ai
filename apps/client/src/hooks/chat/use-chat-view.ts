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
  const { values: queryValues, update: updateQuery } = useQueryParams<{ view: string }>({
    keys: ['view'],
    defaults: {
      view: 'history'
    },
    omit: {
      view: (value) => value === 'history'
    }
  })

  const activeView = normalizeView(queryValues.view)
  const setActiveView = useCallback((view: ChatHeaderView) => {
    updateQuery({ view })
  }, [updateQuery])

  useEffect(() => {
    if (activeView !== queryValues.view) {
      updateQuery({ view: activeView })
    }
  }, [activeView, queryValues.view, updateQuery])

  return {
    activeView,
    setActiveView
  }
}
