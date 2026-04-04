import type { RefObject } from 'react'
import { useEffect, useState } from 'react'

import type { TextAreaRef } from 'antd/es/input/TextArea'

import type { SenderInitialContent } from '#~/components/chat/sender/@types/sender-types'
import { loadChatHistory } from '#~/components/chat/sender/@utils/sender-utils'

export const useSenderHistory = ({
  initialContent,
  input,
  setInput,
  textareaRef
}: {
  initialContent: SenderInitialContent
  input: string
  setInput: (value: string) => void
  textareaRef: RefObject<TextAreaRef>
}) => {
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    resetHistory()
  }, [initialContent])

  const resetHistory = () => {
    setHistoryIndex(-1)
    setDraft('')
  }

  const clearInputValue = () => {
    if (input === '') {
      return
    }
    setInput('')
    setHistoryIndex(-1)
  }

  const handleHistoryNavigation = (direction: 'up' | 'down') => {
    const history = loadChatHistory()
    if (history.length === 0) {
      return
    }

    const nextIndex = direction === 'up'
      ? Math.min(historyIndex + 1, history.length - 1)
      : Math.max(historyIndex - 1, -1)
    if (nextIndex === historyIndex) {
      return
    }

    if (historyIndex === -1) {
      setDraft(input)
    }

    const nextValue = nextIndex === -1 ? draft : history[nextIndex]
    setHistoryIndex(nextIndex)
    setInput(nextValue)

    setTimeout(() => {
      const textArea = textareaRef.current?.resizableTextArea?.textArea
      if (textArea == null) {
        return
      }
      const length = nextValue.length
      textArea.setSelectionRange(length, length)
      textArea.focus()
    }, 0)
  }

  return {
    historyIndex,
    resetHistory,
    clearInputValue,
    handleHistoryNavigation
  }
}
