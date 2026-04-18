import type { ReactNode } from 'react'

import type {
  AskUserQuestionParams,
  ChatMessageContent,
  SessionQueuedMessageMode,
  SessionStatus
} from '@vibe-forge/core'
import type { SessionInfo } from '@vibe-forge/types'

import type { ChatAdapterAccountOption } from '#~/hooks/chat/use-chat-adapter-account-selection'
import type { ChatEffort } from '#~/hooks/chat/use-chat-effort'
import type { ModelSelectMenuGroup, ModelSelectOption } from '#~/hooks/chat/use-chat-model-adapter-selection'
import type { PermissionMode } from '#~/hooks/chat/use-chat-permission-mode'

import type { SenderInitialContent, SenderSubmitResult, SenderVariant } from './sender-types'

export interface SenderProps {
  onSend: (text: string, mode?: SessionQueuedMessageMode) => SenderSubmitResult | Promise<SenderSubmitResult>
  onSendContent: (
    content: ChatMessageContent[],
    mode?: SessionQueuedMessageMode
  ) => SenderSubmitResult | Promise<SenderSubmitResult>
  variant?: SenderVariant
  adapterLocked?: boolean
  sessionStatus?: SessionStatus
  onInterrupt: () => void
  onClear?: () => void
  sessionId?: string
  sessionInfo?: SessionInfo | null
  interactionRequest?: { id: string; payload: AskUserQuestionParams } | null
  onInteractionResponse?: (id: string, data: string | string[]) => void
  interactionOptionNavigation?: {
    optionCount: number
    activeIndex: number
    onMove: (delta: number) => void
    onSubmit: () => void
  }
  placeholder?: string
  initialContent?: SenderInitialContent
  onCancel?: () => void
  submitLabel?: string
  submitLoading?: boolean
  autoFocus?: boolean
  modelMenuGroups?: ModelSelectMenuGroup[]
  modelSearchOptions?: ModelSelectOption[]
  recommendedModelOptions?: ModelSelectOption[]
  servicePreviewModelOptions?: ModelSelectOption[]
  onToggleRecommendedModel?: (option: ModelSelectOption) => void | Promise<void>
  updatingRecommendedModelValue?: string
  selectedModel?: string
  onModelChange?: (model: string) => void
  effort?: ChatEffort
  effortOptions?: Array<{ value: ChatEffort; label: ReactNode }>
  onEffortChange?: (effort: ChatEffort) => void
  permissionMode?: PermissionMode
  permissionModeOptions?: Array<{ value: PermissionMode; label: ReactNode }>
  onPermissionModeChange?: (mode: PermissionMode) => void
  selectedAdapter?: string
  adapterOptions?: Array<{ value: string; label: ReactNode }>
  onAdapterChange?: (adapter: string) => void
  selectedAccount?: string
  accountOptions?: ChatAdapterAccountOption[]
  showAccountSelector?: boolean
  onAccountChange?: (account: string) => void
  modelUnavailable?: boolean
  queueMode?: SessionQueuedMessageMode
  onQueueModeChange?: (mode: SessionQueuedMessageMode) => void
}
