import type { RefObject } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { TextAreaRef } from 'antd/es/input/TextArea'

export const useSenderFocusRestore = ({
  textareaRef,
  suspended = false
}: {
  textareaRef: RefObject<TextAreaRef>
  suspended?: boolean
}) => {
  const [shouldRestoreFocus, setShouldRestoreFocus] = useState(false)
  const focusRestoreTimeoutRef = useRef<number | null>(null)

  const focusTextarea = useCallback(() => {
    if (focusRestoreTimeoutRef.current != null) {
      window.clearTimeout(focusRestoreTimeoutRef.current)
    }

    focusRestoreTimeoutRef.current = window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        const textArea = textareaRef.current?.resizableTextArea?.textArea
        if (textArea == null || textArea.disabled) {
          return
        }

        const length = textArea.value.length
        textArea.focus()
        textArea.setSelectionRange(length, length)
      })
    }, 80)
  }, [textareaRef])

  const queueTextareaFocusRestore = useCallback(() => {
    setShouldRestoreFocus(true)
  }, [])

  const clearQueuedTextareaFocusRestore = useCallback(() => {
    setShouldRestoreFocus(false)
  }, [])

  useEffect(() => {
    return () => {
      if (focusRestoreTimeoutRef.current != null) {
        window.clearTimeout(focusRestoreTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!shouldRestoreFocus || suspended) {
      return
    }

    const timer = window.setTimeout(() => {
      focusTextarea()
      setShouldRestoreFocus(false)
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [focusTextarea, shouldRestoreFocus, suspended])

  return {
    focusTextarea,
    queueTextareaFocusRestore,
    clearQueuedTextareaFocusRestore
  }
}
