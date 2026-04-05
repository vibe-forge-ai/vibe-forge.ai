import type { RefObject } from 'react'
import { useEffect } from 'react'

import type { SenderEditorHandle } from '#~/components/chat/sender/@types/sender-editor'

export const useSenderAutofocus = ({
  autoFocus,
  editorRef
}: {
  autoFocus: boolean
  editorRef: RefObject<SenderEditorHandle | null>
}) => {
  useEffect(() => {
    if (!autoFocus) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      const editor = editorRef.current

      if (editor == null) {
        return
      }

      const length = editor.getValue().length
      editor.focus()
      editor.setSelection({ start: length, end: length })
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [autoFocus, editorRef])
}
