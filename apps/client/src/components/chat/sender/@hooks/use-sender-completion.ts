import type { RefObject } from 'react'
import { useEffect, useState } from 'react'

import type { TextAreaRef } from 'antd/es/input/TextArea'

import type { SessionInfo } from '@vibe-forge/types'

import type { CompletionItem } from '#~/components/chat/sender/@components/completion-menu/CompletionMenu'
import type { SenderInitialContent } from '#~/components/chat/sender/@types/sender-types'

export const useSenderCompletion = ({
  initialContent,
  input,
  setInput,
  sessionInfo,
  textareaRef
}: {
  initialContent: SenderInitialContent
  input: string
  setInput: (value: string) => void
  sessionInfo?: SessionInfo | null
  textareaRef: RefObject<TextAreaRef>
}) => {
  const [showCompletion, setShowCompletion] = useState(false)
  const [completionItems, setCompletionItems] = useState<CompletionItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [triggerChar, setTriggerChar] = useState<string | null>(null)

  useEffect(() => {
    resetCompletion()
  }, [initialContent])

  const resetCompletion = () => {
    setShowCompletion(false)
    setCompletionItems([])
    setSelectedIndex(0)
    setTriggerChar(null)
  }

  const handleSelectCompletion = (item: CompletionItem) => {
    const textArea = textareaRef.current?.resizableTextArea?.textArea
    if (triggerChar == null || textArea == null) {
      return
    }

    const cursorFallback = textArea.selectionStart
    const textBeforeTrigger = input.slice(0, input.lastIndexOf(triggerChar, cursorFallback - 1))
    const textAfterCursor = input.slice(cursorFallback)
    const nextValue = `${textBeforeTrigger}${triggerChar}${item.value} ${textAfterCursor}`

    setInput(nextValue)
    setShowCompletion(false)

    setTimeout(() => {
      const nextTextArea = textareaRef.current?.resizableTextArea?.textArea
      if (nextTextArea == null) {
        return
      }
      const nextCursorPosition = textBeforeTrigger.length + triggerChar.length + item.value.length + 1
      nextTextArea.focus()
      nextTextArea.setSelectionRange(nextCursorPosition, nextCursorPosition)
    }, 0)
  }

  const handleInputChange = (value: string, cursorPosition: number) => {
    setInput(value)
    const charBeforeCursor = value[cursorPosition - 1]

    if (!['/', '@', '#'].includes(charBeforeCursor)) {
      if (showCompletion && !value.includes(triggerChar ?? '')) {
        setShowCompletion(false)
      }
      return
    }

    setTriggerChar(charBeforeCursor)
    let items: CompletionItem[] = []
    if (sessionInfo?.type === 'init') {
      if (charBeforeCursor === '/') {
        items = (sessionInfo.slashCommands ?? []).map(command => ({
          label: `/${command}`,
          value: command,
          icon: 'terminal'
        }))
      } else if (charBeforeCursor === '@') {
        items = (sessionInfo.agents ?? []).map(agent => ({ label: `@${agent}`, value: agent, icon: 'smart_toy' }))
      } else if (charBeforeCursor === '#') {
        items = (sessionInfo.tools ?? []).map(tool => ({ label: `#${tool}`, value: tool, icon: 'check_box' }))
      }
    }

    if (items.length > 0) {
      setCompletionItems(items)
      setSelectedIndex(0)
      setShowCompletion(true)
      return
    }

    setShowCompletion(false)
  }

  return {
    showCompletion,
    completionItems,
    selectedIndex,
    setSelectedIndex,
    setShowCompletion,
    resetCompletion,
    handleInputChange,
    handleSelectCompletion
  }
}
