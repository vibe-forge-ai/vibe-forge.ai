import type { ReactNode, RefObject } from 'react'

import type { RefSelectProps } from 'antd'

import type { SenderProps } from '../@types/sender-props'
import type { SenderToolbarData, SenderToolbarHandlers, SenderToolbarRefs } from '../@types/sender-toolbar-types'

import { createSenderToolbarBindings } from './sender-toolbar-bindings'

export const buildSenderToolbar = ({
  attachments,
  callbacks,
  composer,
  composerControlShortcuts,
  focusRestore,
  isBusy,
  isInlineEdit,
  isMac,
  isThinking,
  sendBlocked,
  sendBlockedTooltip,
  showConfirmInteractionAction,
  confirmInteractionLabel,
  onConfirmInteractionOption,
  message,
  props,
  refs,
  referenceActions,
  queuedMessageShortcuts,
  resolvedSendShortcut,
  selectOverlays,
  supportsEffort,
  t
}: {
  attachments: {
    handleImageFileChange: SenderToolbarHandlers['onImageFileChange']
    handleImageUpload: () => void
    handleOpenContextPicker: () => void
  }
  callbacks: { onSend: (mode?: 'steer' | 'next') => void }
  composer: { input: string; pendingImageCount: number; pendingFileCount: number }
  composerControlShortcuts: Pick<
    SenderToolbarData['composerControlShortcuts'],
    'switchEffort' | 'switchModel' | 'switchPermissionMode'
  >
  focusRestore: { queueEditorFocusRestore: () => void }
  isBusy: boolean
  isInlineEdit: boolean
  isMac: boolean
  isThinking: boolean
  sendBlocked: boolean
  sendBlockedTooltip?: string
  showConfirmInteractionAction: boolean
  confirmInteractionLabel?: string
  onConfirmInteractionOption?: () => void
  message: { warning: (content: ReactNode) => unknown }
  props: SenderProps
  refs: {
    fileInputRef: RefObject<HTMLInputElement>
    modelSelectRef: RefObject<RefSelectProps>
    effortSelectRef: RefObject<RefSelectProps>
  }
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
  queuedMessageShortcuts: Pick<SenderToolbarData['composerControlShortcuts'], 'queueNext' | 'queueSteer'>
  resolvedSendShortcut: string
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
  supportsEffort: boolean
  t: (key: string) => string
}) => {
  const canOpenReferenceActions = !isBusy && (!props.modelUnavailable || isInlineEdit)

  return createSenderToolbarBindings({
    attachments,
    callbacks: {
      onAdapterChange: props.onAdapterChange,
      onEffortChange: props.onEffortChange,
      onInterrupt: props.onInterrupt,
      onModelChange: props.onModelChange,
      onToggleRecommendedModel: props.onToggleRecommendedModel,
      onPermissionModeChange: props.onPermissionModeChange,
      onQueueModeChange: props.onQueueModeChange,
      onCancel: props.onCancel,
      onConfirmInteractionOption,
      onSend: callbacks.onSend
    },
    composer,
    resources: { message, t },
    selection: {
      adapterOptions: props.adapterOptions,
      effort: props.effort ?? 'default',
      effortOptions: props.effortOptions ?? [],
      modelMenuGroups: props.modelMenuGroups,
      modelSearchOptions: props.modelSearchOptions,
      permissionMode: props.permissionMode ?? 'default',
      permissionModeOptions: props.permissionModeOptions ?? [],
      queueMode: props.queueMode ?? 'steer',
      queuedMessageShortcuts,
      recommendedModelOptions: props.recommendedModelOptions,
      servicePreviewModelOptions: props.servicePreviewModelOptions,
      resolvedSendShortcut,
      selectedAdapter: props.selectedAdapter,
      selectedModel: props.selectedModel,
      updatingRecommendedModelValue: props.updatingRecommendedModelValue
    },
    ui: {
      adapterLocked: props.adapterLocked ?? false,
      canOpenReferenceActions,
      composerControlShortcuts,
      focusRestore,
      isInlineEdit,
      isMac,
      isThinking,
      sendBlocked,
      sendBlockedTooltip,
      showConfirmInteractionAction,
      modelUnavailable: props.modelUnavailable,
      hideReferenceActions: props.hideReferenceActions === true,
      hideSubmitAction: props.hideSubmitAction === true,
      referenceActions,
      refs,
      selectOverlays,
      confirmInteractionLabel,
      submitLabel: props.submitLabel,
      submitLoading: props.submitLoading === true,
      supportsEffort
    }
  })
}
