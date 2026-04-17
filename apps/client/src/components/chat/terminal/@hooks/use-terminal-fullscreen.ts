import { useCallback, useEffect, useRef, useState } from 'react'

const FULLSCREEN_EXIT_ANIMATION_MS = 180

export function useTerminalFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isFullscreenExiting, setIsFullscreenExiting] = useState(false)
  const exitTimerRef = useRef<number | null>(null)

  const clearExitTimer = useCallback(() => {
    if (exitTimerRef.current == null) {
      return
    }

    window.clearTimeout(exitTimerRef.current)
    exitTimerRef.current = null
  }, [])

  const enterFullscreen = useCallback(() => {
    clearExitTimer()
    setIsFullscreenExiting(false)
    setIsFullscreen(true)
  }, [clearExitTimer])

  const exitFullscreen = useCallback(() => {
    clearExitTimer()
    setIsFullscreenExiting(true)
    exitTimerRef.current = window.setTimeout(() => {
      setIsFullscreen(false)
      setIsFullscreenExiting(false)
      exitTimerRef.current = null
    }, FULLSCREEN_EXIT_ANIMATION_MS)
  }, [clearExitTimer])

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen && !isFullscreenExiting) {
      exitFullscreen()
      return
    }

    enterFullscreen()
  }, [enterFullscreen, exitFullscreen, isFullscreen, isFullscreenExiting])

  useEffect(() => clearExitTimer, [clearExitTimer])

  return {
    isFullscreen,
    isFullscreenExiting,
    toggleFullscreen
  }
}
