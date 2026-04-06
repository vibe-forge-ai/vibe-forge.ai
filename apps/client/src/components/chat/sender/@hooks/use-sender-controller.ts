import { App } from 'antd'
import { useTranslation } from 'react-i18next'

import { buildSenderControllerResult } from '#~/components/chat/sender/@core/build-sender-controller-result'
import { buildSenderToolbar } from '#~/components/chat/sender/@core/build-sender-toolbar'
import { getSenderInteractionState } from '#~/components/chat/sender/@core/get-sender-interaction-state'
import { getSenderRuntimeState } from '#~/components/chat/sender/@core/get-sender-runtime-state'
import type { SenderProps } from '#~/components/chat/sender/@types/sender-props'

import { useSenderAttachments } from './use-sender-attachments'
import { useSenderAutofocus } from './use-sender-autofocus'
import { useSenderCompletion } from './use-sender-completion'
import { useSenderComposerState } from './use-sender-composer-state'
import { useSenderFocusRestore } from './use-sender-focus-restore'
import { useSenderHistory } from './use-sender-history'
import { useSenderKeydown } from './use-sender-keydown'
import { useSenderReferenceActions } from './use-sender-reference-actions'
import { useSenderReferenceFocusRestore } from './use-sender-reference-focus-restore'
import { useSenderRefs } from './use-sender-refs'
import { useSenderSelectOverlays } from './use-sender-select-overlays'
import { useSenderShortcuts } from './use-sender-shortcuts'
import { useSenderSubmit } from './use-sender-submit'

export const useSenderController = (props: SenderProps) => {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { editorRef, fileInputRef, modelSelectRef, effortSelectRef } = useSenderRefs()
  const { isInlineEdit, isMac, isThinking, isBusy, supportsEffort } = getSenderRuntimeState(props)
  const composer = useSenderComposerState(props.initialContent)
  const completion = useSenderCompletion({
    initialContent: props.initialContent,
    input: composer.input,
    setInput: composer.setInput,
    sessionInfo: props.sessionInfo,
    editorRef
  })
  const history = useSenderHistory({
    initialContent: props.initialContent,
    input: composer.input,
    setInput: composer.setInput,
    editorRef
  })
  const attachments = useSenderAttachments({
    initialContent: props.initialContent,
    isBusy,
    isInlineEdit,
    modelUnavailable: props.modelUnavailable,
    interactionRequest: props.interactionRequest,
    message,
    t,
    fileInputRef,
    setPendingImages: composer.setPendingImages,
    setPendingFiles: composer.setPendingFiles
  })
  const referenceActions = useSenderReferenceActions({
    initialContent: props.initialContent,
    isInlineEdit,
    permissionMode: props.permissionMode ?? 'default',
    permissionModeValues: (props.permissionModeOptions ?? []).map(option => option.value),
    onPermissionSelect: (mode) => props.onPermissionModeChange?.(mode),
    onReferenceImageSelect: attachments.handleImageUpload,
    onOpenContextPicker: attachments.handleOpenContextPicker
  })
  const selectOverlays = useSenderSelectOverlays({
    initialContent: props.initialContent,
    isInlineEdit,
    isThinking,
    modelUnavailable: props.modelUnavailable,
    supportsEffort,
    modelSelectRef,
    effortSelectRef
  })
  const focusRestore = useSenderFocusRestore({
    editorRef,
    suspended: selectOverlays.showModelSelect || selectOverlays.showEffortSelect ||
      referenceActions.showReferenceActions || attachments.showContextPicker
  })
  const { hideSender, permissionContext } = getSenderInteractionState({
    interactionRequest: props.interactionRequest,
    isInlineEdit
  })
  const { clearInputShortcut, composerControlShortcuts, resolvedSendShortcut } = useSenderShortcuts({
    enabled: !hideSender && !attachments.showContextPicker && !isInlineEdit,
    isInlineEdit,
    isMac,
    isThinking,
    modelUnavailable: props.modelUnavailable,
    permissionModeOptions: props.permissionModeOptions ?? [],
    referenceActions,
    selectOverlays
  })

  const resetComposer = () => {
    composer.resetComposerContent()
    completion.resetCompletion()
    history.resetHistory()
    attachments.resetAttachmentUi()
    selectOverlays.resetSelectOverlays()
    referenceActions.resetReferenceActions()
  }
  const handleSend = useSenderSubmit({
    getInput: () => editorRef.current?.getValue() ?? composer.input,
    pendingImages: composer.pendingImages,
    pendingFiles: composer.pendingFiles,
    isBusy,
    isInlineEdit,
    modelUnavailable: props.modelUnavailable,
    interactionRequest: props.interactionRequest,
    onInteractionResponse: props.onInteractionResponse,
    onSend: props.onSend,
    onSendContent: props.onSendContent,
    message,
    t,
    resetComposer
  })
  const triggerSend = () => void handleSend()

  useSenderAutofocus({ autoFocus: props.autoFocus === true, editorRef })
  useSenderReferenceFocusRestore({ focusRestore, referenceActions })

  const handleKeyDown = useSenderKeydown({
    editorRef,
    isMac,
    clearInputShortcut,
    isInlineEdit,
    input: composer.input,
    pendingImageCount: composer.pendingImages.length,
    pendingFileCount: composer.pendingFiles.length,
    onCancel: props.onCancel,
    onClear: props.onClear,
    onResetComposer: resetComposer,
    showReferenceActions: referenceActions.showReferenceActions,
    onCloseReferenceActions: () => referenceActions.closeReferenceActions({ restoreFocus: true }),
    showModelSelect: selectOverlays.showModelSelect,
    onCloseModelSelect: () => {
      selectOverlays.setShowModelSelect(false)
      focusRestore.queueEditorFocusRestore()
    },
    showEffortSelect: selectOverlays.showEffortSelect,
    onCloseEffortSelect: () => {
      selectOverlays.setShowEffortSelect(false)
      focusRestore.queueEditorFocusRestore()
    },
    showCompletion: completion.showCompletion,
    historyIndex: history.historyIndex,
    onHistoryNavigate: history.handleHistoryNavigation,
    onInputClear: history.clearInputValue
  })
  const toolbar = buildSenderToolbar({
    attachments,
    callbacks: { onSend: triggerSend },
    composer: {
      input: composer.input,
      pendingImageCount: composer.pendingImages.length,
      pendingFileCount: composer.pendingFiles.length
    },
    composerControlShortcuts,
    focusRestore,
    isBusy,
    isInlineEdit,
    isMac,
    isThinking,
    message,
    props,
    refs: { fileInputRef, modelSelectRef, effortSelectRef },
    referenceActions,
    resolvedSendShortcut,
    selectOverlays,
    supportsEffort,
    t
  })

  return buildSenderControllerResult({
    attachments,
    completion,
    composer,
    errorBanner: props.errorBanner,
    focusRestore,
    handleKeyDown,
    hideSender,
    interactionRequest: props.interactionRequest,
    interactionResponse: props.onInteractionResponse,
    isBusy,
    isInlineEdit,
    isThinking,
    modelUnavailable: props.modelUnavailable,
    onRetryConnection: props.onRetryConnection,
    permissionContext,
    editorRef,
    placeholder: props.placeholder ?? props.interactionRequest?.payload.question ?? t('chat.inputPlaceholder'),
    toolbar
  })
}
