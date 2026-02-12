import { useEffect } from 'react'

import { isShortcutMatch } from '../utils/shortcutUtils'

export const useGlobalShortcut = ({
  shortcut,
  enabled = true,
  isMac,
  onTrigger
}: {
  shortcut?: string
  enabled?: boolean
  isMac: boolean
  onTrigger: (event: KeyboardEvent) => void
}) => {
  useEffect(() => {
    if (!enabled) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isShortcutMatch(event, shortcut, isMac)) {
        onTrigger(event)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, isMac, onTrigger, shortcut])
}
