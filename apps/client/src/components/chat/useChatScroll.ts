import { useCallback, useEffect, useRef, useState } from 'react'

const SCROLL_THRESHOLD = 80

export function useChatScroll({ messagesLength }: { messagesLength: number }) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesContentRef = useRef<HTMLDivElement>(null)
  const [showScrollBottom, setShowScrollBottom] = useState(false)

  const updateScrollState = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return
    const distanceToBottom = container.scrollHeight - (container.scrollTop + container.clientHeight)
    setShowScrollBottom(distanceToBottom > SCROLL_THRESHOLD)
  }, [])

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTo({
          top: messagesContainerRef.current.scrollHeight,
          behavior
        })
      }
    }, 50)
  }, [])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return
    updateScrollState()
    const handleScroll = () => updateScrollState()
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', handleScroll)
    }
  }, [updateScrollState])

  useEffect(() => {
    updateScrollState()
  }, [updateScrollState, messagesLength])

  return {
    messagesEndRef,
    messagesContainerRef,
    messagesContentRef,
    showScrollBottom,
    scrollToBottom
  }
}
