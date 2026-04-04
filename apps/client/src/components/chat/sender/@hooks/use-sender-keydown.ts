import type { KeyboardEvent } from 'react'

import { loadChatHistory } from '#~/components/chat/sender/@utils/sender-utils'
import { isShortcutMatch } from '#~/utils/shortcutUtils'

export const useSenderKeydown = ({
  isMac,
  resolvedSendShortcut,
  clearInputShortcut,
  isInlineEdit,
  input,
  pendingImageCount,
  pendingFileCount,
  onCancel,
  onClear,
  onSend,
  onResetComposer,
  showReferenceActions,
  onCloseReferenceActions,
  showModelSelect,
  onCloseModelSelect,
  showEffortSelect,
  onCloseEffortSelect,
  showCompletion,
  completionItems,
  selectedIndex,
  onCompletionIndexChange,
  onCompletionSelect,
  onCompletionClose,
  historyIndex,
  onHistoryNavigate,
  onInputClear
}: {
  isMac: boolean
  resolvedSendShortcut: string
  clearInputShortcut?: string
  isInlineEdit: boolean
  input: string
  pendingImageCount: number
  pendingFileCount: number
  onCancel?: () => void
  onClear?: () => void
  onSend: () => void
  onResetComposer: () => void
  showReferenceActions: boolean
  onCloseReferenceActions: () => void
  showModelSelect: boolean
  onCloseModelSelect: () => void
  showEffortSelect: boolean
  onCloseEffortSelect: () => void
  showCompletion: boolean
  completionItems: Array<{ value: string }>
  selectedIndex: number
  onCompletionIndexChange: (updater: (current: number) => number) => void
  onCompletionSelect: (item: { value: string }) => void
  onCompletionClose: () => void
  historyIndex: number
  onHistoryNavigate: (direction: 'up' | 'down') => void
  onInputClear: () => void
}) => {
  return (event: KeyboardEvent) => {
    if (showReferenceActions && event.key === 'Escape') {
      event.preventDefault()
      onCloseReferenceActions()
      return
    }
    if (showModelSelect && event.key === 'Escape') {
      event.preventDefault()
      onCloseModelSelect()
      return
    }
    if (showEffortSelect && event.key === 'Escape') {
      event.preventDefault()
      onCloseEffortSelect()
      return
    }
    if (isShortcutMatch(event, resolvedSendShortcut, isMac)) {
      event.preventDefault()
      onSend()
      return
    }
    if (clearInputShortcut?.trim() && isShortcutMatch(event, clearInputShortcut, isMac)) {
      event.preventDefault()
      onInputClear()
      return
    }
    if (showCompletion) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        onCompletionIndexChange(current => (current + 1) % completionItems.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        onCompletionIndexChange(current => (current - 1 + completionItems.length) % completionItems.length)
        return
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        const selectedItem = completionItems[selectedIndex]
        if (selectedItem != null) {
          onCompletionSelect(selectedItem)
        }
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        onCompletionClose()
        return
      }
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const textarea = event.target as HTMLTextAreaElement
      const history = loadChatHistory()
      const currentHistoryValue = historyIndex === -1 ? null : history[historyIndex]
      const textSegment = event.key === 'ArrowUp'
        ? textarea.value.substring(0, textarea.selectionStart)
        : textarea.value.substring(textarea.selectionEnd)
      if (!textSegment.includes('\n')) {
        const canMoveUp = event.key === 'ArrowUp' && (input.trim() === '' || input === currentHistoryValue)
        const canMoveDown = event.key === 'ArrowDown' && (historyIndex !== -1 || input === currentHistoryValue)
        if (canMoveUp || canMoveDown) {
          event.preventDefault()
          onHistoryNavigate(event.key === 'ArrowUp' ? 'up' : 'down')
          return
        }
      }
    }
    if (event.key === 'Escape') {
      if (isInlineEdit && input === '' && pendingImageCount === 0 && pendingFileCount === 0 && onCancel != null) {
        event.preventDefault()
        onCancel()
        return
      }
      if (input !== '') {
        event.preventDefault()
        onInputClear()
      }
      return
    }
    if (event.key === 'l' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      if (isInlineEdit) {
        onResetComposer()
        return
      }
      onInputClear()
      onClear?.()
      return
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      onSend()
    }
  }
}
