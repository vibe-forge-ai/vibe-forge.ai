import type { ReactNode } from 'react'

import type { ChatEffort } from '#~/hooks/chat/use-chat-effort'
import type { ModelSelectOption } from '#~/hooks/chat/use-chat-model-adapter-selection'
import type { PermissionMode } from '#~/hooks/chat/use-chat-permission-mode'
import type { SessionQueuedMessageMode } from '@vibe-forge/core'

import type { SenderToolbarHandlers } from '../@types/sender-toolbar-types'

export const createSenderToolbarHandlers = ({
  attachments,
  canOpenReferenceActions,
  focusRestore,
  isInlineEdit,
  message,
  modelUnavailable,
  onAdapterChange,
  onEffortChange,
  onInterrupt,
  onModelChange,
  onToggleRecommendedModel,
  onPermissionModeChange,
  onQueueModeChange,
  onCancel,
  onSend,
  referenceActions,
  selectOverlays,
  t
}: {
  attachments: {
    handleImageFileChange: SenderToolbarHandlers['onImageFileChange']
    handleImageUpload: () => void
    handleOpenContextPicker: () => void
  }
  canOpenReferenceActions: boolean
  focusRestore: { queueEditorFocusRestore: () => void }
  isInlineEdit: boolean
  message: { warning: (content: ReactNode) => unknown }
  modelUnavailable?: boolean
  onAdapterChange?: (adapter: string) => void
  onEffortChange?: (effort: ChatEffort) => void
  onInterrupt: () => void
  onModelChange?: (model: string) => void
  onToggleRecommendedModel?: (option: ModelSelectOption) => void | Promise<void>
  onPermissionModeChange?: (mode: PermissionMode) => void
  onQueueModeChange?: (mode: SessionQueuedMessageMode) => void
  onCancel?: () => void
  onSend: (mode?: SessionQueuedMessageMode) => void
  referenceActions: {
    setShowReferenceActions: (nextOpen: boolean) => void
    setShowPermissionActions: (nextOpen: boolean) => void
    closeReferenceActions: (options?: { restoreFocus?: boolean }) => void
    handleReferenceMenuKeyDown: SenderToolbarHandlers['onReferenceMenuKeyDown']
    handlePermissionMenuKeyDown: SenderToolbarHandlers['onPermissionMenuKeyDown']
  }
  selectOverlays: {
    setShowModelSelect: (nextOpen: boolean) => void
    setShowEffortSelect: (nextOpen: boolean) => void
    setModelSearchValue: (value: string) => void
    openModelSelector: () => boolean
    openEffortSelector: () => boolean
  }
  t: (key: string) => string
}) => {
  return {
    onImageFileChange: attachments.handleImageFileChange,
    onReferenceOpenChange: (nextOpen) => {
      if (nextOpen && !canOpenReferenceActions) {
        if (!isInlineEdit && modelUnavailable) {
          void message.warning(t('chat.modelConfigRequired'))
        }
        return
      }

      selectOverlays.setShowModelSelect(false)
      selectOverlays.setShowEffortSelect(false)

      if (!nextOpen) {
        referenceActions.closeReferenceActions({ restoreFocus: true })
        return
      }

      referenceActions.setShowPermissionActions(false)
      referenceActions.setShowReferenceActions(true)
    },
    onShowModelSelectChange: selectOverlays.setShowModelSelect,
    onShowEffortSelectChange: selectOverlays.setShowEffortSelect,
    onShowPermissionActionsChange: referenceActions.setShowPermissionActions,
    onModelSearchValueChange: selectOverlays.setModelSearchValue,
    onOpenContextPicker: attachments.handleOpenContextPicker,
    onReferenceImageSelect: attachments.handleImageUpload,
    onSelectPermissionMode: (mode) => {
      onPermissionModeChange?.(mode)
      referenceActions.closeReferenceActions({ restoreFocus: true })
    },
    onReferenceMenuKeyDown: referenceActions.handleReferenceMenuKeyDown,
    onPermissionMenuKeyDown: referenceActions.handlePermissionMenuKeyDown,
    onOpenModelSelector: () => {
      if (selectOverlays.openModelSelector()) {
        referenceActions.closeReferenceActions()
      }
    },
    onOpenEffortSelector: () => {
      if (selectOverlays.openEffortSelector()) {
        referenceActions.closeReferenceActions()
      }
    },
    onQueueTextareaFocusRestore: focusRestore.queueEditorFocusRestore,
    onCloseReferenceActions: () => referenceActions.closeReferenceActions(),
    onModelChange,
    onToggleRecommendedModel,
    onEffortChange,
    onAdapterChange,
    onQueueModeChange,
    onSend,
    onInterrupt,
    onCancel
  } satisfies SenderToolbarHandlers
}
