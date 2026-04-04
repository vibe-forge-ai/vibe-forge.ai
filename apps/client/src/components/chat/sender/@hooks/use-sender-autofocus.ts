import type { RefObject } from 'react'
import { useEffect } from 'react'

import type { TextAreaRef } from 'antd/es/input/TextArea'

export const useSenderAutofocus = ({
  autoFocus,
  textareaRef
}: {
  autoFocus: boolean
  textareaRef: RefObject<TextAreaRef>
}) => {
  useEffect(() => {
    if (!autoFocus) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      const textArea = textareaRef.current?.resizableTextArea?.textArea
      if (textArea == null) {
        return
      }
      const length = textArea.value.length
      textArea.focus()
      textArea.setSelectionRange(length, length)
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [autoFocus, textareaRef])
}
