import type { ChangeEvent, ClipboardEvent, Dispatch, KeyboardEvent, RefObject, SetStateAction } from 'react'

import type { TextAreaRef } from 'antd/es/input/TextArea'

import type { CompletionItem } from '../@components/completion-menu/CompletionMenu'
import type { PendingContextFile, PendingImage } from '../@types/sender-composer'
import type { SenderProps } from '../@types/sender-props'
import type {
  SenderToolbarData,
  SenderToolbarHandlers,
  SenderToolbarRefs,
  SenderToolbarState
} from '../@types/sender-toolbar-types'

interface SenderControllerAttachments {
  handlePaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void | Promise<void>
  showContextPicker: boolean
  setShowContextPicker: (nextOpen: boolean) => void
  handleContextPickerConfirm: (files: PendingContextFile[]) => void
}

interface SenderControllerCompletion {
  showCompletion: boolean
  completionItems: CompletionItem[]
  selectedIndex: number
  setShowCompletion: (nextOpen: boolean) => void
  handleInputChange: (value: string, cursorPosition: number | null) => void
  handleSelectCompletion: (item: CompletionItem) => void
}

interface SenderControllerComposer {
  input: string
  pendingImages: PendingImage[]
  pendingFiles: PendingContextFile[]
  setPendingImages: Dispatch<SetStateAction<PendingImage[]>>
  setPendingFiles: Dispatch<SetStateAction<PendingContextFile[]>>
}

interface SenderControllerToolbar {
  toolbarState: SenderToolbarState
  toolbarData: SenderToolbarData
  toolbarRefs: SenderToolbarRefs
  toolbarHandlers: SenderToolbarHandlers
}

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
  attachments: SenderControllerAttachments
  completion: SenderControllerCompletion
  composer: SenderControllerComposer
  connectionError?: string | null
  focusRestore: { queueTextareaFocusRestore: () => void }
  handleKeyDown: (event: KeyboardEvent) => void
  hideSender: boolean
  interactionRequest?: SenderProps['interactionRequest']
  interactionResponse?: SenderProps['onInteractionResponse']
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
  toolbar: SenderControllerToolbar
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
  onConfirmContextPicker: (files: PendingContextFile[]) => {
    attachments.handleContextPickerConfirm(files)
    focusRestore.queueTextareaFocusRestore()
  }
})
