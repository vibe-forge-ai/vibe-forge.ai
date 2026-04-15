import type { ChangeEvent, KeyboardEvent, ReactNode, RefObject } from 'react'

import type { SessionQueuedMessageMode } from '@vibe-forge/core'
import type { RefSelectProps } from 'antd'

import type { ChatEffort } from '#~/hooks/chat/use-chat-effort'
import type { ModelSelectMenuGroup, ModelSelectOption } from '#~/hooks/chat/use-chat-model-adapter-selection'
import type { PermissionMode } from '#~/hooks/chat/use-chat-permission-mode'
import type { ReferenceMenuKey, RovingFocusNavigation } from './sender-types'

export interface SenderToolbarShortcuts {
  switchModel: string
  switchEffort: string
  switchPermissionMode: string
  queueSteer: string
  queueNext: string
}

export interface SenderToolbarState {
  isInlineEdit: boolean
  isThinking: boolean
  modelUnavailable: boolean
  sendBlocked: boolean
  sendBlockedTooltip?: string
  showConfirmInteractionAction: boolean
  adapterLocked: boolean
  submitLoading: boolean
  supportsEffort: boolean
  canOpenReferenceActions: boolean
  showModelSelect: boolean
  showEffortSelect: boolean
  showReferenceActions: boolean
  showPermissionActions: boolean
  modelSearchValue: string
  selectedModel?: string
  effort: ChatEffort
  permissionMode: PermissionMode
  selectedAdapter?: string
  isMac: boolean
  resolvedSendShortcut: string
  hasComposerContent: boolean
  hasSendText: boolean
  queueMode: SessionQueuedMessageMode
  showQueueModeControl: boolean
}

export interface SenderToolbarData {
  modelMenuGroups?: ModelSelectMenuGroup[]
  modelSearchOptions?: ModelSelectOption[]
  recommendedModelOptions?: ModelSelectOption[]
  servicePreviewModelOptions?: ModelSelectOption[]
  updatingRecommendedModelValue?: string
  effortOptions: Array<{ value: ChatEffort; label: ReactNode }>
  permissionModeOptions: Array<{ value: PermissionMode; label: ReactNode }>
  adapterOptions?: Array<{ value: string; label: ReactNode }>
  composerControlShortcuts: SenderToolbarShortcuts
  submitLabel?: string
  confirmInteractionLabel?: string
}

export interface SenderToolbarRefs {
  fileInputRef: RefObject<HTMLInputElement>
  modelSelectRef: RefObject<RefSelectProps>
  effortSelectRef: RefObject<RefSelectProps>
  referenceMenuNavigation: RovingFocusNavigation<ReferenceMenuKey>
  permissionMenuNavigation: RovingFocusNavigation<PermissionMode>
}

export interface SenderToolbarHandlers {
  onImageFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onReferenceOpenChange: (nextOpen: boolean) => void
  onShowModelSelectChange: (nextOpen: boolean) => void
  onShowEffortSelectChange: (nextOpen: boolean) => void
  onShowPermissionActionsChange: (nextOpen: boolean) => void
  onModelSearchValueChange: (value: string) => void
  onOpenContextPicker: () => void
  onReferenceImageSelect: () => void
  onSelectPermissionMode: (mode: PermissionMode) => void
  onReferenceMenuKeyDown: (event: KeyboardEvent<HTMLButtonElement>, key: ReferenceMenuKey) => void
  onPermissionMenuKeyDown: (event: KeyboardEvent<HTMLButtonElement>, key: PermissionMode) => void
  onOpenModelSelector: () => void
  onOpenEffortSelector: () => void
  onQueueTextareaFocusRestore: () => void
  onCloseReferenceActions: () => void
  onModelChange?: (model: string) => void
  onToggleRecommendedModel?: (option: ModelSelectOption) => void | Promise<void>
  onEffortChange?: (effort: ChatEffort) => void
  onAdapterChange?: (adapter: string) => void
  onSend: (mode?: SessionQueuedMessageMode) => void
  onInterrupt: () => void
  onCancel?: () => void
  onConfirmInteractionOption?: () => void
  onQueueModeChange?: (mode: SessionQueuedMessageMode) => void
}
