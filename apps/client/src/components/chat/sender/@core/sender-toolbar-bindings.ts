import type { ReactNode } from 'react'

import type { SessionQueuedMessageMode } from '@vibe-forge/core'

import type { ChatEffort } from '#~/hooks/chat/use-chat-effort'
import type { ModelSelectMenuGroup, ModelSelectOption } from '#~/hooks/chat/use-chat-model-adapter-selection'
import type { PermissionMode } from '#~/hooks/chat/use-chat-permission-mode'

import type {
  SenderToolbarData,
  SenderToolbarHandlers,
  SenderToolbarRefs,
  SenderToolbarState
} from '../@types/sender-toolbar-types'

import { createSenderToolbarHandlers } from './create-sender-toolbar-handlers'

export const createSenderToolbarBindings = ({
  attachments,
  callbacks,
  composer,
  resources,
  selection,
  ui
}: {
  attachments: {
    handleImageFileChange: SenderToolbarHandlers['onImageFileChange']
    handleImageUpload: () => void
    handleOpenContextPicker: () => void
  }
  callbacks: {
    onAdapterChange?: (adapter: string) => void
    onEffortChange?: (effort: ChatEffort) => void
    onInterrupt: () => void
    onModelChange?: (model: string) => void
    onToggleRecommendedModel?: (option: ModelSelectOption) => void | Promise<void>
    onPermissionModeChange?: (mode: PermissionMode) => void
    onQueueModeChange?: (mode: SessionQueuedMessageMode) => void
    onCancel?: () => void
    onConfirmInteractionOption?: () => void
    onSend: (mode?: SessionQueuedMessageMode) => void
  }
  composer: { input: string; pendingImageCount: number; pendingFileCount: number }
  resources: { message: { warning: (content: ReactNode) => unknown }; t: (key: string) => string }
  selection: {
    adapterOptions?: Array<{ value: string; label: ReactNode }>
    effort: ChatEffort
    effortOptions: SenderToolbarData['effortOptions']
    modelMenuGroups?: ModelSelectMenuGroup[]
    modelSearchOptions?: ModelSelectOption[]
    permissionMode: PermissionMode
    permissionModeOptions: SenderToolbarData['permissionModeOptions']
    queueMode: SessionQueuedMessageMode
    queuedMessageShortcuts: Pick<SenderToolbarData['composerControlShortcuts'], 'queueNext' | 'queueSteer'>
    recommendedModelOptions?: ModelSelectOption[]
    servicePreviewModelOptions?: ModelSelectOption[]
    resolvedSendShortcut: string
    selectedAdapter?: string
    selectedModel?: string
    updatingRecommendedModelValue?: string
  }
  ui: {
    adapterLocked: boolean
    canOpenReferenceActions: boolean
    composerControlShortcuts: Pick<
      SenderToolbarData['composerControlShortcuts'],
      'switchEffort' | 'switchModel' | 'switchPermissionMode'
    >
    focusRestore: { queueEditorFocusRestore: () => void }
    isInlineEdit: boolean
    isMac: boolean
    isThinking: boolean
    sendBlocked: boolean
    sendBlockedTooltip?: string
    showConfirmInteractionAction: boolean
    modelUnavailable?: boolean
    referenceActions: {
      showReferenceActions: boolean
      showPermissionActions: boolean
      setShowReferenceActions: (nextOpen: boolean) => void
      setShowPermissionActions: (nextOpen: boolean) => void
      closeReferenceActions: (options?: { restoreFocus?: boolean }) => void
      handleReferenceMenuKeyDown: SenderToolbarHandlers['onReferenceMenuKeyDown']
      handlePermissionMenuKeyDown: SenderToolbarHandlers['onPermissionMenuKeyDown']
      referenceMenuNavigation: SenderToolbarRefs['referenceMenuNavigation']
      permissionMenuNavigation: SenderToolbarRefs['permissionMenuNavigation']
    }
    refs: Pick<SenderToolbarRefs, 'effortSelectRef' | 'fileInputRef' | 'modelSelectRef'>
    selectOverlays: {
      showModelSelect: boolean
      setShowModelSelect: (nextOpen: boolean) => void
      showEffortSelect: boolean
      setShowEffortSelect: (nextOpen: boolean) => void
      modelSearchValue: string
      setModelSearchValue: (value: string) => void
      openModelSelector: () => boolean
      openEffortSelector: () => boolean
    }
    submitLabel?: string
    confirmInteractionLabel?: string
    submitLoading: boolean
    supportsEffort: boolean
  }
}) => {
  const toolbarState: SenderToolbarState = {
    isInlineEdit: ui.isInlineEdit,
    isThinking: ui.isThinking,
    modelUnavailable: Boolean(ui.modelUnavailable),
    sendBlocked: ui.sendBlocked,
    sendBlockedTooltip: ui.sendBlockedTooltip,
    showConfirmInteractionAction: ui.showConfirmInteractionAction,
    adapterLocked: ui.adapterLocked,
    submitLoading: ui.submitLoading,
    supportsEffort: ui.supportsEffort,
    canOpenReferenceActions: ui.canOpenReferenceActions,
    showModelSelect: ui.selectOverlays.showModelSelect,
    showEffortSelect: ui.selectOverlays.showEffortSelect,
    showReferenceActions: ui.referenceActions.showReferenceActions,
    showPermissionActions: ui.referenceActions.showPermissionActions,
    modelSearchValue: ui.selectOverlays.modelSearchValue,
    selectedModel: selection.selectedModel,
    effort: selection.effort,
    permissionMode: selection.permissionMode,
    selectedAdapter: selection.selectedAdapter,
    isMac: ui.isMac,
    resolvedSendShortcut: selection.resolvedSendShortcut,
    queueMode: selection.queueMode,
    showQueueModeControl: ui.isThinking && !ui.isInlineEdit,
    hasComposerContent: composer.input.trim() !== '' || composer.pendingImageCount > 0 || composer.pendingFileCount > 0,
    hasSendText: composer.input.trim() !== ''
  }

  const toolbarData: SenderToolbarData = {
    modelMenuGroups: selection.modelMenuGroups,
    modelSearchOptions: selection.modelSearchOptions,
    recommendedModelOptions: selection.recommendedModelOptions,
    servicePreviewModelOptions: selection.servicePreviewModelOptions,
    updatingRecommendedModelValue: selection.updatingRecommendedModelValue,
    effortOptions: selection.effortOptions,
    permissionModeOptions: selection.permissionModeOptions,
    adapterOptions: selection.adapterOptions,
    composerControlShortcuts: {
      ...ui.composerControlShortcuts,
      ...selection.queuedMessageShortcuts
    },
    submitLabel: ui.submitLabel,
    confirmInteractionLabel: ui.confirmInteractionLabel
  }

  const toolbarRefs: SenderToolbarRefs = {
    ...ui.refs,
    referenceMenuNavigation: ui.referenceActions.referenceMenuNavigation,
    permissionMenuNavigation: ui.referenceActions.permissionMenuNavigation
  }

  const toolbarHandlers = createSenderToolbarHandlers({
    attachments,
    canOpenReferenceActions: ui.canOpenReferenceActions,
    focusRestore: ui.focusRestore,
    isInlineEdit: ui.isInlineEdit,
    message: resources.message,
    modelUnavailable: ui.modelUnavailable,
    onAdapterChange: callbacks.onAdapterChange,
    onEffortChange: callbacks.onEffortChange,
    onInterrupt: callbacks.onInterrupt,
    onModelChange: callbacks.onModelChange,
    onToggleRecommendedModel: callbacks.onToggleRecommendedModel,
    onPermissionModeChange: callbacks.onPermissionModeChange,
    onQueueModeChange: callbacks.onQueueModeChange,
    onCancel: callbacks.onCancel,
    onConfirmInteractionOption: callbacks.onConfirmInteractionOption,
    onSend: callbacks.onSend,
    referenceActions: ui.referenceActions,
    selectOverlays: ui.selectOverlays,
    t: resources.t
  })

  return { toolbarState, toolbarData, toolbarRefs, toolbarHandlers }
}
