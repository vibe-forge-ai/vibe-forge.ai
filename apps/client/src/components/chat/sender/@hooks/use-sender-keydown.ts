import type { RefObject } from 'react'

import type { SenderEditorHandle } from '#~/components/chat/sender/@types/sender-editor'
import { loadChatHistory } from '#~/components/chat/sender/@utils/sender-utils'
import { isShortcutMatch } from '#~/utils/shortcutUtils'

export const useSenderKeydown = ({
  editorRef,
  isMac,
  clearInputShortcut,
  isInlineEdit,
  input,
  pendingImageCount,
  pendingFileCount,
  onCancel,
  onClear,
  onResetComposer,
  showReferenceActions,
  onCloseReferenceActions,
  showModelSelect,
  onCloseModelSelect,
  showEffortSelect,
  onCloseEffortSelect,
  showCompletion,
  historyIndex,
  onHistoryNavigate,
  onInputClear
}: {
  editorRef: RefObject<SenderEditorHandle | null>
  isMac: boolean
  clearInputShortcut?: string
  isInlineEdit: boolean
  input: string
  pendingImageCount: number
  pendingFileCount: number
  onCancel?: () => void
  onClear?: () => void
  onResetComposer: () => void
  showReferenceActions: boolean
  onCloseReferenceActions: () => void
  showModelSelect: boolean
  onCloseModelSelect: () => void
  showEffortSelect: boolean
  onCloseEffortSelect: () => void
  showCompletion: boolean
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
    if (showCompletion && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab'].includes(event.key)) {
      return
    }
    if (clearInputShortcut?.trim() && isShortcutMatch(event, clearInputShortcut, isMac)) {
      event.preventDefault()
      onInputClear()
      return
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const selection = editorRef.current?.getSelection()
      const history = loadChatHistory()
      const currentHistoryValue = historyIndex === -1 ? null : history[historyIndex]
      const textSegment = event.key === 'ArrowUp'
        ? input.substring(0, selection?.start ?? input.length)
        : input.substring(selection?.end ?? input.length)
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
    }
  }
}
