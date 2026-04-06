import type { RefObject } from 'react'
import { useCallback, useEffect, useState } from 'react'

import type { SessionInfo } from '@vibe-forge/types'

import type { SenderEditorHandle } from '#~/components/chat/sender/@types/sender-editor'
import type { SenderInitialContent } from '#~/components/chat/sender/@types/sender-types'
import {
  resolveSenderCompletionMatch,
  resolveSenderTokenDecorations
} from '#~/components/chat/sender/@utils/sender-completion'

export const useSenderCompletion = ({
  initialContent,
  input,
  setInput,
  sessionInfo,
  editorRef
}: {
  initialContent: SenderInitialContent
  input: string
  setInput: (value: string) => void
  sessionInfo?: SessionInfo | null
  editorRef: RefObject<SenderEditorHandle | null>
}) => {
  const [showCompletion, setShowCompletion] = useState(false)

  const resetCompletion = useCallback(() => {
    setShowCompletion(false)
  }, [])

  useEffect(() => {
    resetCompletion()
  }, [initialContent, resetCompletion])

  const syncCompletionState = useCallback((value: string, cursorPosition: number | null) => {
    const resolvedCursorPosition = cursorPosition ??
      editorRef.current?.getSelection()?.end ??
      value.length
    const nextMatch = resolveSenderCompletionMatch(value, resolvedCursorPosition, sessionInfo)

    setShowCompletion((nextMatch?.items.length ?? 0) > 0)
  }, [editorRef, sessionInfo])

  const handleInputChange = useCallback((value: string, cursorPosition: number | null) => {
    setInput(value)
    syncCompletionState(value, cursorPosition)
  }, [setInput, syncCompletionState])

  const handleCursorChange = useCallback((cursorPosition: number | null) => {
    syncCompletionState(input, cursorPosition)
  }, [input, syncCompletionState])

  return {
    showCompletion,
    resetCompletion,
    handleInputChange,
    handleCursorChange,
    resolveCompletionMatch: resolveSenderCompletionMatch,
    resolveTokenDecorations: resolveSenderTokenDecorations
  }
}
