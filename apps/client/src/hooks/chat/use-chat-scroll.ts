import { useCallback, useEffect, useRef, useState } from 'react'

const SCROLL_THRESHOLD = 80

export function useChatScroll({ contentVersion }: { contentVersion: number }) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesContentRef = useRef<HTMLDivElement>(null)
  const scrollTimeoutRef = useRef<number | null>(null)
  const [showScrollBottom, setShowScrollBottom] = useState(false)

  const updateScrollState = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return
    const distanceToBottom = container.scrollHeight - (container.scrollTop + container.clientHeight)
    setShowScrollBottom(distanceToBottom > SCROLL_THRESHOLD)
  }, [])

  const clearScrollTimeout = useCallback(() => {
    if (scrollTimeoutRef.current == null) {
      return
    }

    window.clearTimeout(scrollTimeoutRef.current)
    scrollTimeoutRef.current = null
  }, [])

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    clearScrollTimeout()
    scrollTimeoutRef.current = window.setTimeout(() => {
      const container = messagesContainerRef.current
      scrollTimeoutRef.current = null
      if (!container) {
        return
      }

      container.scrollTo({
        top: container.scrollHeight,
        behavior
      })
    }, 50)
  }, [clearScrollTimeout])

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
  }, [contentVersion, updateScrollState])

  useEffect(() => clearScrollTimeout, [clearScrollTimeout])

  return {
    messagesEndRef,
    messagesContainerRef,
    messagesContentRef,
    showScrollBottom,
    scrollToBottom
  }
}
