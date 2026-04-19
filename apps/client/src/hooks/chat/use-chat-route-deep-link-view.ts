import { useEffect, useRef } from 'react'

import type { ChatHeaderView } from '#~/components/chat/ChatHeader.js'

export function useChatRouteDeepLinkView({
  activeView,
  setActiveView,
  targetMessageId,
  targetToolUseId
}: {
  activeView: ChatHeaderView
  setActiveView: (view: ChatHeaderView) => void
  targetMessageId?: string
  targetToolUseId?: string
}) {
  const handledDeepLinkTargetRef = useRef('')
  const deepLinkTargetKey = targetToolUseId?.trim()
    ? `tool:${targetToolUseId.trim()}`
    : targetMessageId?.trim()
    ? `message:${targetMessageId.trim()}`
    : ''

  useEffect(() => {
    if (deepLinkTargetKey === '') {
      handledDeepLinkTargetRef.current = ''
    } else if (handledDeepLinkTargetRef.current !== deepLinkTargetKey) {
      handledDeepLinkTargetRef.current = deepLinkTargetKey
      if (activeView !== 'history') {
        setActiveView('history')
      }
    }
  }, [activeView, deepLinkTargetKey, setActiveView])
}
