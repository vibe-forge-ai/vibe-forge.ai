import type { TFunction } from 'i18next'

import type { MessageInstance } from 'antd/es/message/interface'

import { buildMessageContent } from '#~/components/chat/sender/@core/content-attachments'
import type { SenderSubmitResult } from '#~/components/chat/sender/@types/sender-types'
import { saveChatHistoryEntry } from '#~/components/chat/sender/@utils/sender-utils'

export const useSenderSubmit = ({
  input,
  pendingImages,
  pendingFiles,
  isBusy,
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
  input: string
  pendingImages: Parameters<typeof buildMessageContent>[1]
  pendingFiles: Parameters<typeof buildMessageContent>[2]
  isBusy: boolean
  isInlineEdit: boolean
  modelUnavailable?: boolean
  interactionRequest?: { id: string } | null
  onInteractionResponse?: (id: string, data: string | string[]) => void
  onSend: (text: string) => SenderSubmitResult | Promise<SenderSubmitResult>
  onSendContent: (content: ReturnType<typeof buildMessageContent>) => SenderSubmitResult | Promise<SenderSubmitResult>
  message: MessageInstance
  t: TFunction
  resetComposer: () => void
}) => {
  return async () => {
    if (isBusy || (input.trim() === '' && pendingImages.length === 0 && pendingFiles.length === 0)) {
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
        didSubmit = (await onSendContent(content)) !== false
      } else {
        void onSendContent(content)
      }
    } else if (isInlineEdit) {
      didSubmit = (await onSend(input)) !== false
    } else {
      void onSend(input)
    }

    if (!didSubmit) {
      return
    }

    saveChatHistoryEntry(input)
    resetComposer()
  }
}
