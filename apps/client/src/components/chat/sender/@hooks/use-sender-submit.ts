import type { SessionQueuedMessageMode } from '@vibe-forge/core'
import type { TFunction } from 'i18next'

import type { MessageInstance } from 'antd/es/message/interface'

import { buildMessageContent } from '#~/components/chat/sender/@core/content-attachments'
import type { SenderSubmitResult } from '#~/components/chat/sender/@types/sender-types'
import { saveChatHistoryEntry } from '#~/components/chat/sender/@utils/sender-utils'

export const useSenderSubmit = ({
  getInput,
  pendingImages,
  pendingFiles,
  isBusy,
  allowWhileBusy,
  isInlineEdit,
  modelUnavailable,
  interactionRequest,
  onInteractionResponse,
  onSend,
  onSendContent,
  message,
  t,
  resetComposer
}: {
  getInput: () => string
  pendingImages: Parameters<typeof buildMessageContent>[1]
  pendingFiles: Parameters<typeof buildMessageContent>[2]
  isBusy: boolean
  allowWhileBusy: boolean
  isInlineEdit: boolean
  modelUnavailable?: boolean
  interactionRequest?: { id: string } | null
  onInteractionResponse?: (id: string, data: string | string[]) => void
  onSend: (text: string, mode?: SessionQueuedMessageMode) => SenderSubmitResult | Promise<SenderSubmitResult>
  onSendContent: (
    content: ReturnType<typeof buildMessageContent>,
    mode?: SessionQueuedMessageMode
  ) => SenderSubmitResult | Promise<SenderSubmitResult>
  message: MessageInstance
  t: TFunction
  resetComposer: () => void
}) => {
  return async (mode?: SessionQueuedMessageMode) => {
    const input = getInput()

    if (
      ((isBusy && !allowWhileBusy) || (input.trim() === '' && pendingImages.length === 0 && pendingFiles.length === 0))
    ) {
      return
    }
    if (!isInlineEdit && modelUnavailable) {
      void message.warning(t('chat.modelConfigRequired'))
      return
    }
    if (!isInlineEdit && interactionRequest != null && onInteractionResponse != null) {
      if (pendingImages.length > 0 || pendingFiles.length > 0) {
        void message.warning(
          pendingImages.length > 0 ? t('chat.imageNotSupportedInInteraction') : t('chat.fileNotSupportedInInteraction')
        )
        return
      }
      onInteractionResponse(interactionRequest.id, input.trim())
      resetComposer()
      return
    }

    let didSubmit = true
    if (pendingImages.length > 0 || pendingFiles.length > 0) {
      const content = buildMessageContent(input, pendingImages, pendingFiles)
      if (isInlineEdit) {
        didSubmit = (await onSendContent(content, mode)) !== false
      } else {
        void onSendContent(content, mode)
      }
    } else if (isInlineEdit) {
      didSubmit = (await onSend(input, mode)) !== false
    } else {
      void onSend(input, mode)
    }

    if (!didSubmit) {
      return
    }

    saveChatHistoryEntry(input)
    resetComposer()
  }
}
