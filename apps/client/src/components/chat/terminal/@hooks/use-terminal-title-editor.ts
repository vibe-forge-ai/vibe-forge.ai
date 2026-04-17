import { useEffect, useRef, useState } from 'react'

import type { TerminalPaneConfig } from '../@utils/terminal-panes'

export function useTerminalTitleEditor({
  onActivate,
  onRename,
  panes
}: {
  onActivate: (terminalId: string) => void
  onRename: (terminalId: string, title: string) => void
  panes: TerminalPaneConfig[]
}) {
  const [editingTerminalId, setEditingTerminalId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const editingInputRef = useRef<HTMLInputElement | null>(null)
  const editingTerminalIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (editingTerminalId == null) {
      return
    }

    window.requestAnimationFrame(() => {
      editingInputRef.current?.focus()
      editingInputRef.current?.select()
    })
  }, [editingTerminalId])

  useEffect(() => {
    if (editingTerminalId != null && panes.every(pane => pane.id !== editingTerminalId)) {
      editingTerminalIdRef.current = null
      setEditingTerminalId(null)
      setEditingTitle('')
    }
  }, [editingTerminalId, panes])

  const startEditing = (pane: TerminalPaneConfig) => {
    onActivate(pane.id)
    editingTerminalIdRef.current = pane.id
    setEditingTerminalId(pane.id)
    setEditingTitle(pane.title)
  }

  const cancelEditing = () => {
    editingTerminalIdRef.current = null
    setEditingTerminalId(null)
    setEditingTitle('')
  }

  const finishEditing = () => {
    const terminalId = editingTerminalIdRef.current
    if (terminalId != null) {
      const title = editingTitle.trim()
      if (title !== '') {
        onRename(terminalId, title)
      }
    }

    cancelEditing()
  }

  return {
    cancelEditing,
    editingInputRef,
    editingTerminalId,
    editingTitle,
    finishEditing,
    setEditingTitle,
    startEditing
  }
}
