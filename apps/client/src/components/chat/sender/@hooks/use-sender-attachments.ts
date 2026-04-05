import type { TFunction } from 'i18next'
import type { ChangeEvent, RefObject } from 'react'
import { useEffect, useState } from 'react'

import type { MessageInstance } from 'antd/es/message/interface'

import type { AskUserQuestionParams } from '@vibe-forge/core'

import type { PendingContextFile, PendingImage } from '#~/components/chat/sender/@types/sender-composer'
import type { SenderInitialContent } from '#~/components/chat/sender/@types/sender-types'
import { readFileAsDataUrl } from '#~/components/chat/sender/@utils/sender-utils'

interface ClipboardPasteEvent {
  clipboardData?: DataTransfer | null
  preventDefault: () => void
}

export const useSenderAttachments = ({
  initialContent,
  isBusy,
  isInlineEdit,
  modelUnavailable,
  interactionRequest,
  message,
  t,
  fileInputRef,
  setPendingImages,
  setPendingFiles
}: {
  initialContent: SenderInitialContent
  isBusy: boolean
  isInlineEdit: boolean
  modelUnavailable?: boolean
  interactionRequest?: { id: string; payload: AskUserQuestionParams } | null
  message: MessageInstance
  t: TFunction
  fileInputRef: RefObject<HTMLInputElement>
  setPendingImages: React.Dispatch<React.SetStateAction<PendingImage[]>>
  setPendingFiles: React.Dispatch<React.SetStateAction<PendingContextFile[]>>
}) => {
  const [showContextPicker, setShowContextPicker] = useState(false)

  useEffect(() => {
    resetAttachmentUi()
  }, [initialContent])

  const resetAttachmentUi = () => {
    setShowContextPicker(false)
  }

  const addImageFiles = async (files: File[]) => {
    const maxSize = 5 * 1024 * 1024
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        continue
      }
      if (file.size > maxSize) {
        void message.error(t('chat.imageTooLarge'))
        continue
      }
      try {
        const url = await readFileAsDataUrl(file)
        if (url === '') {
          void message.error(t('chat.imageReadFailed'))
          continue
        }
        setPendingImages(prev => [...prev, {
          id: globalThis.crypto?.randomUUID
            ? globalThis.crypto.randomUUID()
            : `img-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          url,
          name: file.name,
          size: file.size,
          mimeType: file.type
        }])
      } catch {
        void message.error(t('chat.imageReadFailed'))
      }
    }
  }

  const handleImageUpload = () => {
    if (isBusy) {
      return
    }
    if (!isInlineEdit && modelUnavailable) {
      void message.warning(t('chat.modelConfigRequired'))
      return
    }
    if (!isInlineEdit && interactionRequest != null) {
      void message.warning(t('chat.imageNotSupportedInInteraction'))
      return
    }
    fileInputRef.current?.click()
  }

  const handleImageFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(event.target.files ?? [])
    if (fileList.length === 0) {
      return
    }
    await addImageFiles(fileList)
    event.target.value = ''
  }

  const handleOpenContextPicker = () => {
    if (isBusy || isInlineEdit) {
      return
    }
    if (!isInlineEdit && modelUnavailable) {
      void message.warning(t('chat.modelConfigRequired'))
      return
    }
    if (!isInlineEdit && interactionRequest != null) {
      void message.warning(t('chat.fileNotSupportedInInteraction'))
      return
    }
    setShowContextPicker(true)
  }

  return {
    showContextPicker,
    setShowContextPicker,
    resetAttachmentUi,
    handleImageUpload,
    handleImageFileChange,
    handleOpenContextPicker,
    handleContextPickerConfirm: (files: Array<{ path: string; name?: string; size?: number }>) => {
      setPendingFiles(files)
      setShowContextPicker(false)
    },
    handlePaste: async (event: ClipboardPasteEvent) => {
      const files = Array.from(event.clipboardData?.items ?? [])
        .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
        .map(item => item.getAsFile())
        .filter((file): file is File => file != null)
      if (files.length > 0) {
        event.preventDefault()
        await addImageFiles(files)
      }
    }
  }
}
