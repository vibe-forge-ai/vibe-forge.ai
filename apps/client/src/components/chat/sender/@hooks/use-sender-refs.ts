import { useRef } from 'react'

import type { RefSelectProps } from 'antd'

import type { SenderEditorHandle } from '#~/components/chat/sender/@types/sender-editor'

export const useSenderRefs = () => {
  const editorRef = useRef<SenderEditorHandle | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const modelSelectRef = useRef<RefSelectProps>(null)
  const effortSelectRef = useRef<RefSelectProps>(null)

  return {
    editorRef,
    fileInputRef,
    modelSelectRef,
    effortSelectRef
  }
}
