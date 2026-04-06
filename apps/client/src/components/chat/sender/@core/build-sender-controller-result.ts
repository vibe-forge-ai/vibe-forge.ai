import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

import type { PendingContextFile, PendingImage } from '../@types/sender-composer'
import type { SenderEditorHandle } from '../@types/sender-editor'
import type { SenderProps } from '../@types/sender-props'
import type {
  SenderToolbarData,
  SenderToolbarHandlers,
  SenderToolbarRefs,
  SenderToolbarState
} from '../@types/sender-toolbar-types'
import type { SenderCompletionMatch, SenderTokenDecoration } from '../@utils/sender-completion'

interface SenderControllerAttachments {
  handlePaste: (event: ClipboardEvent) => void | Promise<void>
  showContextPicker: boolean
  setShowContextPicker: (nextOpen: boolean) => void
  handleContextPickerConfirm: (files: PendingContextFile[]) => void
}

interface SenderControllerCompletion {
  showCompletion: boolean
  handleInputChange: (value: string, cursorPosition: number | null) => void
  handleCursorChange: (cursorPosition: number | null) => void
  resolveCompletionMatch: (
    value: string,
    cursorOffset: number | null,
    sessionInfo?: SenderProps['sessionInfo']
  ) => SenderCompletionMatch | null
  resolveTokenDecorations: (value: string) => SenderTokenDecoration[]
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
  errorBanner,
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
  secondarySendShortcut,
  onSecondarySendShortcut,
  editorRef,
  toolbar
}: {
  attachments: SenderControllerAttachments
  completion: SenderControllerCompletion
  composer: SenderControllerComposer
  errorBanner?: SenderProps['errorBanner']
  focusRestore: { queueEditorFocusRestore: () => void }
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
  secondarySendShortcut?: string
  onSecondarySendShortcut?: () => void
  editorRef: MutableRefObject<SenderEditorHandle | null>
  toolbar: SenderControllerToolbar
}) => ({
  isInlineEdit,
  isThinking,
  isBusy,
  hideSender,
  permissionContext,
  deniedTools: permissionContext?.deniedTools?.filter(tool => tool.trim() !== '') ?? [],
  reasons: permissionContext?.reasons?.filter(reason => reason.trim() !== '') ?? [],
  editorRef,
  composer,
  completion,
  attachments,
  toolbar,
  handleKeyDown,
  interactionRequest,
  interactionResponse,
  errorBanner,
  onRetryConnection,
  modelUnavailable,
  placeholder,
  secondarySendShortcut,
  onSecondarySendShortcut,
  onInputChange: completion.handleInputChange,
  onCursorChange: completion.handleCursorChange,
  onCancelContextPicker: () => {
    attachments.setShowContextPicker(false)
    focusRestore.queueEditorFocusRestore()
  },
  onConfirmContextPicker: (files: PendingContextFile[]) => {
    attachments.handleContextPickerConfirm(files)
    focusRestore.queueEditorFocusRestore()
  }
})
