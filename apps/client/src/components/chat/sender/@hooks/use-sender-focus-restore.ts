import type { RefObject } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { SenderEditorHandle } from '#~/components/chat/sender/@types/sender-editor'

export const useSenderFocusRestore = ({
  editorRef,
  suspended = false
}: {
  editorRef: RefObject<SenderEditorHandle | null>
  suspended?: boolean
}) => {
  const [shouldRestoreFocus, setShouldRestoreFocus] = useState(false)
  const focusRestoreTimeoutRef = useRef<number | null>(null)

  const focusEditor = useCallback(() => {
    if (focusRestoreTimeoutRef.current != null) {
      window.clearTimeout(focusRestoreTimeoutRef.current)
    }

    focusRestoreTimeoutRef.current = window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        const editor = editorRef.current

        if (editor == null || editor.isDisabled()) {
          return
        }

        const length = editor.getValue().length
        editor.focus()
        editor.setSelection({ start: length, end: length })
      })
    }, 80)
  }, [editorRef])

  const queueEditorFocusRestore = useCallback(() => {
    setShouldRestoreFocus(true)
  }, [])

  const clearQueuedEditorFocusRestore = useCallback(() => {
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
      focusEditor()
      setShouldRestoreFocus(false)
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [focusEditor, shouldRestoreFocus, suspended])

  return {
    focusEditor,
    queueEditorFocusRestore,
    clearQueuedEditorFocusRestore
  }
}
