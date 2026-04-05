import { useEffect, useState } from 'react'

import { getInitialComposerState } from '#~/components/chat/sender/@core/content-attachments'
import type { SenderInitialContent } from '#~/components/chat/sender/@types/sender-types'

export const useSenderComposerState = (initialContent: SenderInitialContent) => {
  const initialState = getInitialComposerState(initialContent)
  const [input, setInput] = useState(() => initialState.input)
  const [pendingImages, setPendingImages] = useState(() => initialState.pendingImages)
  const [pendingFiles, setPendingFiles] = useState(() => initialState.pendingFiles)

  useEffect(() => {
    const nextState = getInitialComposerState(initialContent)
    setInput(nextState.input)
    setPendingImages(nextState.pendingImages)
    setPendingFiles(nextState.pendingFiles)
  }, [initialContent])

  const resetComposerContent = () => {
    setInput('')
    setPendingImages([])
    setPendingFiles([])
  }

  return {
    input,
    setInput,
    pendingImages,
    setPendingImages,
    pendingFiles,
    setPendingFiles,
    resetComposerContent
  }
}
