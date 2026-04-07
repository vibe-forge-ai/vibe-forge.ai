import { useEffect, useState } from 'react'

const TERMINAL_EXIT_ANIMATION_MS = 240

export function useTerminalDockVisibility(isOpen: boolean) {
  const [isRendered, setIsRendered] = useState(isOpen)
  const [isVisible, setIsVisible] = useState(isOpen)

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true)
      const timeoutId = window.setTimeout(() => {
        setIsVisible(true)
      }, 0)
      return () => {
        window.clearTimeout(timeoutId)
      }
    }

    setIsVisible(false)

    if (!isRendered) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setIsRendered(false)
    }, TERMINAL_EXIT_ANIMATION_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [isOpen, isRendered])

  return {
    isRendered,
    isVisible
  }
}
