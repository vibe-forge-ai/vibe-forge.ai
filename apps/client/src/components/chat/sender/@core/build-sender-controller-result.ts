import type { ChangeEvent, KeyboardEvent, RefObject } from 'react'

import type { TextAreaRef } from 'antd/es/input/TextArea'

export const buildSenderControllerResult = ({
  attachments,
  completion,
  composer,
  connectionError,
  focusRestore,
  handleKeyDown,
  hideSender,
  interactionRequest,
  interactionResponse,
  isBusy,
  isInlineEdit,
  isThinking,
  modelUnavailable,
  onRetryConnection,
  permissionContext,
  placeholder,
  textareaRef,
  toolbar
}: {
  attachments: {
    setShowContextPicker: (nextOpen: boolean) => void
    handleContextPickerConfirm: (files: Array<{ path: string; name?: string; size?: number }>) => void
  }
  completion: { handleInputChange: (value: string, selectionStart: number | null) => void }
  composer: unknown
  connectionError?: string | null
  focusRestore: { queueTextareaFocusRestore: () => void }
  handleKeyDown: (event: KeyboardEvent) => void
  hideSender: boolean
  interactionRequest?: unknown
  interactionResponse?: ((id: string, data: string | string[]) => void) | undefined
  isBusy: boolean
  isInlineEdit: boolean
  isThinking: boolean
  modelUnavailable?: boolean
  onRetryConnection?: (() => void) | undefined
  permissionContext?: {
    deniedTools?: string[]
    reasons?: string[]
  }
  placeholder: string
  textareaRef: RefObject<TextAreaRef>
  toolbar: unknown
}) => ({
  isInlineEdit,
  isThinking,
  isBusy,
  hideSender,
  permissionContext,
  deniedTools: permissionContext?.deniedTools?.filter(tool => tool.trim() !== '') ?? [],
  reasons: permissionContext?.reasons?.filter(reason => reason.trim() !== '') ?? [],
  textareaRef,
  composer,
  completion,
  attachments,
  toolbar,
  handleKeyDown,
  interactionRequest,
  interactionResponse,
  connectionError,
  onRetryConnection,
  modelUnavailable,
  placeholder,
  onInputChange: (event: ChangeEvent<HTMLTextAreaElement>) =>
    completion.handleInputChange(event.target.value, event.target.selectionStart),
  onCancelContextPicker: () => {
    attachments.setShowContextPicker(false)
    focusRestore.queueTextareaFocusRestore()
  },
  onConfirmContextPicker: (files: Array<{ path: string; name?: string; size?: number }>) => {
    attachments.handleContextPickerConfirm(files)
    focusRestore.queueTextareaFocusRestore()
  }
})
