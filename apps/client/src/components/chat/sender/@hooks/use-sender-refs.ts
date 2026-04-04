import { useRef } from 'react'

import type { RefSelectProps } from 'antd'
import type { TextAreaRef } from 'antd/es/input/TextArea'

export const useSenderRefs = () => {
  const textareaRef = useRef<TextAreaRef>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const modelSelectRef = useRef<RefSelectProps>(null)
  const effortSelectRef = useRef<RefSelectProps>(null)

  return {
    textareaRef,
    fileInputRef,
    modelSelectRef,
    effortSelectRef
  }
}
