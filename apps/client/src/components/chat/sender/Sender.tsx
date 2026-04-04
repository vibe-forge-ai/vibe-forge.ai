import './Sender.scss'

import { App, Button, Input } from 'antd'
import type { RefSelectProps } from 'antd'
import type { TextAreaRef } from 'antd/es/input/TextArea'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import type { ChatEffort } from '#~/hooks/chat/use-chat-effort'
import type { ModelSelectMenuGroup, ModelSelectOption } from '#~/hooks/chat/use-chat-model-adapter-selection'
import type { PermissionMode } from '#~/hooks/chat/use-chat-permission-mode'
import { useComposerControlShortcuts } from '#~/hooks/chat/use-composer-control-shortcuts'
import { useRovingFocusList } from '#~/hooks/use-roving-focus-list'
import type { AskUserQuestionParams, ChatMessageContent, SessionStatus } from '@vibe-forge/core'
import type { ConfigResponse, SessionInfo } from '@vibe-forge/types'
import { isShortcutMatch } from '../../../utils/shortcutUtils'
import type { CompletionItem } from './CompletionMenu'
import { CompletionMenu } from './CompletionMenu'
import { ContextFilePicker } from './ContextFilePicker'
import { SenderAttachments } from './SenderAttachments'
import { SenderInteractionPanel } from './SenderInteractionPanel'
import { SenderToolbar } from './SenderToolbar'
import { ThinkingStatus } from './ThinkingStatus'
import { buildMessageContent, getInitialComposerState } from './content-attachments'
import { shouldHideSenderForInteraction } from './interaction-request'
import type {
  MenuFocusTarget,
  ReferenceMenuKey,
  SenderInitialContent,
  SenderSubmitResult,
  SenderVariant
} from './sender-types'
import { isActivationKey, loadChatHistory, readFileAsDataUrl, saveChatHistoryEntry } from './sender-utils'
import { useSenderFocusRestore } from './use-sender-focus-restore'

const { TextArea } = Input

export function Sender({
  onSend,
  onSendContent,
  variant = 'default',
  adapterLocked = false,
  sessionStatus,
  onInterrupt,
  onClear,
  sessionInfo,
  connectionError,
  onRetryConnection,
  interactionRequest,
  onInteractionResponse,
  placeholder,
  initialContent,
  onCancel,
  submitLabel,
  submitLoading = false,
  autoFocus = false,
  modelMenuGroups,
  modelSearchOptions,
  recommendedModelOptions,
  selectedModel,
  onModelChange,
  effort = 'default',
  effortOptions = [],
  onEffortChange,
  permissionMode = 'default',
  permissionModeOptions = [],
  onPermissionModeChange,
  selectedAdapter,
  adapterOptions,
  onAdapterChange,
  modelUnavailable
}: {
  onSend: (text: string) => SenderSubmitResult | Promise<SenderSubmitResult>
  onSendContent: (content: ChatMessageContent[]) => SenderSubmitResult | Promise<SenderSubmitResult>
  variant?: SenderVariant
  adapterLocked?: boolean
  sessionStatus?: SessionStatus
  onInterrupt: () => void
  onClear?: () => void
  sessionInfo?: SessionInfo | null
  connectionError?: string | null
  onRetryConnection?: () => void
  interactionRequest?: { id: string; payload: AskUserQuestionParams } | null
  onInteractionResponse?: (id: string, data: string | string[]) => void
  placeholder?: string
  initialContent?: SenderInitialContent
  onCancel?: () => void
  submitLabel?: string
  submitLoading?: boolean
  autoFocus?: boolean
  modelMenuGroups?: ModelSelectMenuGroup[]
  modelSearchOptions?: ModelSelectOption[]
  recommendedModelOptions?: ModelSelectOption[]
  selectedModel?: string
  onModelChange?: (model: string) => void
  effort?: ChatEffort
  effortOptions?: Array<{ value: ChatEffort; label: React.ReactNode }>
  onEffortChange?: (effort: ChatEffort) => void
  permissionMode?: PermissionMode
  permissionModeOptions?: Array<{ value: PermissionMode; label: React.ReactNode }>
  onPermissionModeChange?: (mode: PermissionMode) => void
  selectedAdapter?: string
  adapterOptions?: Array<{ value: string; label: React.ReactNode }>
  onAdapterChange?: (adapter: string) => void
  modelUnavailable?: boolean
}) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const isInlineEdit = variant === 'inline-edit'
  const initialComposerState = getInitialComposerState(initialContent)
  const [input, setInput] = useState(() => initialComposerState.input)
  const [pendingImages, setPendingImages] = useState(() => initialComposerState.pendingImages)
  const [pendingFiles, setPendingFiles] = useState(() => initialComposerState.pendingFiles)
  const [showCompletion, setShowCompletion] = useState(false)
  const [completionItems, setCompletionItems] = useState<CompletionItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [triggerChar, setTriggerChar] = useState<string | null>(null)
  const [showModelSelect, setShowModelSelect] = useState(false)
  const [showEffortSelect, setShowEffortSelect] = useState(false)
  const [showReferenceActions, setShowReferenceActions] = useState(false)
  const [showPermissionActions, setShowPermissionActions] = useState(false)
  const [modelSearchValue, setModelSearchValue] = useState('')
  const [menuFocusTarget, setMenuFocusTarget] = useState<MenuFocusTarget>(null)
  const [showContextPicker, setShowContextPicker] = useState(false)
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [draft, setDraft] = useState('')
  const textareaRef = useRef<TextAreaRef>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const modelSelectRef = useRef<RefSelectProps>(null)
  const effortSelectRef = useRef<RefSelectProps>(null)
  const isMac = navigator.platform.includes('Mac')

  const { data: configRes } = useSWR<ConfigResponse>('/api/config')
  const mergedShortcuts = configRes?.sources?.merged?.shortcuts
  const sendShortcut = mergedShortcuts?.sendMessage
  const clearInputShortcut = mergedShortcuts?.clearInput
  const resolvedSendShortcut = sendShortcut != null && sendShortcut.trim() !== ''
    ? sendShortcut
    : 'mod+enter'

  const { queueTextareaFocusRestore, clearQueuedTextareaFocusRestore } = useSenderFocusRestore({
    textareaRef,
    suspended: showModelSelect || showEffortSelect || showReferenceActions || showContextPicker
  })

  useEffect(() => {
    const nextState = getInitialComposerState(initialContent)
    setInput(nextState.input)
    setPendingImages(nextState.pendingImages)
    setPendingFiles(nextState.pendingFiles)
    setDraft('')
    setHistoryIndex(-1)
    setShowCompletion(false)
    setSelectedIndex(0)
    setTriggerChar(null)
    setShowModelSelect(false)
    setShowEffortSelect(false)
    setShowReferenceActions(false)
    setShowPermissionActions(false)
    setModelSearchValue('')
    clearQueuedTextareaFocusRestore()
    setMenuFocusTarget(null)
    setShowContextPicker(false)
  }, [clearQueuedTextareaFocusRestore, initialContent])

  useEffect(() => {
    if (!autoFocus) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      const textArea = textareaRef.current?.resizableTextArea?.textArea
      if (textArea == null) {
        return
      }

      const length = textArea.value.length
      textArea.focus()
      textArea.setSelectionRange(length, length)
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [autoFocus])

  const isThinking = !isInlineEdit && sessionStatus === 'running'
  const isBusy = isThinking || submitLoading
  const supportsEffort = selectedAdapter === 'codex' || selectedAdapter === 'claude-code' ||
    selectedAdapter === 'opencode'
  const referenceMenuKeys = useMemo<ReferenceMenuKey[]>(() => {
    const keys: ReferenceMenuKey[] = ['image']
    if (!isInlineEdit) {
      keys.push('file')
    }
    if (!isInlineEdit && permissionModeOptions.length > 0) {
      keys.push('permission')
    }
    return keys
  }, [isInlineEdit, permissionModeOptions.length])
  const permissionMenuKeys = useMemo(() => {
    return permissionModeOptions.map(option => option.value)
  }, [permissionModeOptions])
  const referenceMenuNavigation = useRovingFocusList(referenceMenuKeys, 'image')
  const permissionMenuNavigation = useRovingFocusList(permissionMenuKeys, permissionMode)

  useEffect(() => {
    if (permissionMenuKeys.includes(permissionMode)) {
      permissionMenuNavigation.setActiveKey(permissionMode)
    }
  }, [permissionMenuKeys, permissionMenuNavigation, permissionMode])

  useEffect(() => {
    if (menuFocusTarget !== 'reference' || !showReferenceActions || showPermissionActions) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      referenceMenuNavigation.focusKey(referenceMenuNavigation.activeKey ?? referenceMenuKeys[0] ?? null)
      setMenuFocusTarget(null)
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [
    menuFocusTarget,
    referenceMenuKeys,
    referenceMenuNavigation,
    showPermissionActions,
    showReferenceActions
  ])

  useEffect(() => {
    if (menuFocusTarget !== 'permission' || !showReferenceActions || !showPermissionActions) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      permissionMenuNavigation.focusKey(permissionMenuNavigation.activeKey ?? permissionMode)
      setMenuFocusTarget(null)
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [menuFocusTarget, permissionMenuNavigation, permissionMode, showPermissionActions, showReferenceActions])

  const addImageFiles = async (files: File[]) => {
    const maxSize = 5 * 1024 * 1024
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        continue
      }
      if (file.size > maxSize) {
        void message.error(t('chat.imageTooLarge'))
        continue
      }
      try {
        const url = await readFileAsDataUrl(file)
        if (url === '') {
          void message.error(t('chat.imageReadFailed'))
          continue
        }
        setPendingImages(prev => [
          ...prev,
          {
            id: globalThis.crypto?.randomUUID
              ? globalThis.crypto.randomUUID()
              : `img-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            url,
            name: file.name,
            size: file.size,
            mimeType: file.type
          }
        ])
      } catch {
        void message.error(t('chat.imageReadFailed'))
      }
    }
  }

  const resetComposer = () => {
    setInput('')
    setPendingImages([])
    setPendingFiles([])
    setDraft('')
    setShowCompletion(false)
    setHistoryIndex(-1)
  }

  const handleSend = async () => {
    if (isBusy) {
      return
    }
    if (input.trim() === '' && pendingImages.length === 0 && pendingFiles.length === 0) {
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
        const result = await onSendContent(content)
        didSubmit = result !== false
      } else {
        void onSendContent(content)
      }
    } else if (isInlineEdit) {
      const result = await onSend(input)
      didSubmit = result !== false
    } else {
      void onSend(input)
    }

    if (!didSubmit) {
      return
    }

    saveChatHistoryEntry(input)
    resetComposer()
  }

  const handleImageUpload = () => {
    if (isBusy) {
      return
    }
    if (!isInlineEdit && modelUnavailable) {
      void message.warning(t('chat.modelConfigRequired'))
      return
    }
    if (!isInlineEdit && interactionRequest != null) {
      void message.warning(t('chat.imageNotSupportedInInteraction'))
      return
    }
    fileInputRef.current?.click()
  }

  const handleImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(event.target.files ?? [])
    if (fileList.length === 0) {
      return
    }
    await addImageFiles(fileList)
    event.target.value = ''
  }

  const handleOpenContextPicker = () => {
    if (isBusy || isInlineEdit) {
      return
    }
    if (!isInlineEdit && modelUnavailable) {
      void message.warning(t('chat.modelConfigRequired'))
      return
    }
    if (!isInlineEdit && interactionRequest != null) {
      void message.warning(t('chat.fileNotSupportedInInteraction'))
      return
    }
    setShowContextPicker(true)
  }

  const handleContextPickerConfirm = (
    files: Array<{ path: string; name?: string; size?: number }>
  ) => {
    setPendingFiles(files)
    setShowContextPicker(false)
    queueTextareaFocusRestore()
  }

  const closeReferenceActions = ({ restoreFocus = false }: { restoreFocus?: boolean } = {}) => {
    setShowReferenceActions(false)
    setShowPermissionActions(false)
    setMenuFocusTarget(null)
    if (restoreFocus) {
      queueTextareaFocusRestore()
    }
  }

  const canOpenReferenceActions = !isBusy && (!modelUnavailable || isInlineEdit)

  const handleReferenceOpenChange = (nextOpen: boolean) => {
    if (nextOpen && !canOpenReferenceActions) {
      if (!isInlineEdit && modelUnavailable) {
        void message.warning(t('chat.modelConfigRequired'))
      }
      return
    }
    setShowModelSelect(false)
    setShowEffortSelect(false)
    if (!nextOpen) {
      closeReferenceActions({ restoreFocus: true })
      return
    }
    setShowPermissionActions(false)
    setMenuFocusTarget(null)
    setShowReferenceActions(true)
  }

  const handlePermissionModeSelect = (mode: PermissionMode) => {
    onPermissionModeChange?.(mode)
    closeReferenceActions({ restoreFocus: true })
  }

  const handleReferenceImageSelect = () => {
    closeReferenceActions()
    handleImageUpload()
  }

  const focusSelectControl = (selectRef: React.RefObject<RefSelectProps>) => {
    window.requestAnimationFrame(() => {
      selectRef.current?.focus?.()
    })
  }

  const openModelSelector = () => {
    if (isInlineEdit || modelUnavailable || isThinking) {
      return
    }
    setShowEffortSelect(false)
    closeReferenceActions()
    setModelSearchValue('')
    setShowModelSelect(true)
    focusSelectControl(modelSelectRef)
  }

  const openEffortSelector = () => {
    if (isInlineEdit || modelUnavailable || isThinking || !supportsEffort) {
      return
    }
    setShowModelSelect(false)
    closeReferenceActions()
    setShowEffortSelect(true)
    focusSelectControl(effortSelectRef)
  }

  const openPermissionShortcutMenu = () => {
    if (isInlineEdit || modelUnavailable || isThinking || permissionModeOptions.length === 0) {
      return
    }
    setShowModelSelect(false)
    setShowEffortSelect(false)
    setShowReferenceActions(true)
    setShowPermissionActions(true)
    referenceMenuNavigation.setActiveKey('permission')
    permissionMenuNavigation.setActiveKey(permissionMode)
    setMenuFocusTarget('permission')
  }

  const handleReferenceMenuKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    key: ReferenceMenuKey
  ) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (key !== 'permission') {
        setShowPermissionActions(false)
      }
      referenceMenuNavigation.moveFocus(1, key)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (key !== 'permission') {
        setShowPermissionActions(false)
      }
      referenceMenuNavigation.moveFocus(-1, key)
      return
    }

    if (event.key === 'ArrowRight' && key === 'permission' && permissionModeOptions.length > 0) {
      event.preventDefault()
      setShowPermissionActions(true)
      permissionMenuNavigation.setActiveKey(permissionMode)
      setMenuFocusTarget('permission')
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      closeReferenceActions({ restoreFocus: true })
      return
    }

    if (!isActivationKey(event.key)) {
      return
    }

    event.preventDefault()
    if (key === 'image') {
      handleReferenceImageSelect()
      return
    }
    if (key === 'file') {
      closeReferenceActions()
      handleOpenContextPicker()
      return
    }

    setShowPermissionActions(prev => {
      const nextOpen = !prev
      if (nextOpen) {
        permissionMenuNavigation.setActiveKey(permissionMode)
        setMenuFocusTarget('permission')
      }
      return nextOpen
    })
  }

  const handlePermissionMenuKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    key: PermissionMode
  ) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      permissionMenuNavigation.moveFocus(1, key)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      permissionMenuNavigation.moveFocus(-1, key)
      return
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setShowPermissionActions(false)
      referenceMenuNavigation.setActiveKey('permission')
      setMenuFocusTarget('reference')
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      closeReferenceActions({ restoreFocus: true })
      return
    }

    if (!isActivationKey(event.key)) {
      return
    }

    event.preventDefault()
    handlePermissionModeSelect(key)
  }

  useEffect(() => {
    if (!showModelSelect && !showEffortSelect && !showReferenceActions) {
      return
    }

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      if (showReferenceActions) {
        event.preventDefault()
        event.stopPropagation()
        setShowReferenceActions(false)
        setShowPermissionActions(false)
        setMenuFocusTarget(null)
        queueTextareaFocusRestore()
        return
      }

      if (showModelSelect) {
        event.preventDefault()
        event.stopPropagation()
        setShowModelSelect(false)
        queueTextareaFocusRestore()
        return
      }

      if (showEffortSelect) {
        event.preventDefault()
        event.stopPropagation()
        setShowEffortSelect(false)
        queueTextareaFocusRestore()
      }
    }

    window.addEventListener('keydown', handleWindowKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown, true)
    }
  }, [queueTextareaFocusRestore, showEffortSelect, showModelSelect, showReferenceActions])

  const handlePaste = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(event.clipboardData?.items ?? [])
    const files = items
      .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
      .map(item => item.getAsFile())
      .filter((file): file is File => file != null)
    if (files.length > 0) {
      event.preventDefault()
      await addImageFiles(files)
    }
  }

  const clearInputValue = () => {
    if (input === '') {
      return
    }
    setInput('')
    setHistoryIndex(-1)
  }

  const handleHistoryNavigation = (direction: 'up' | 'down') => {
    const history = loadChatHistory()
    if (history.length === 0) {
      return
    }

    let nextIndex = historyIndex
    if (direction === 'up') {
      nextIndex = Math.min(historyIndex + 1, history.length - 1)
    } else {
      nextIndex = Math.max(historyIndex - 1, -1)
    }

    if (nextIndex === historyIndex) {
      return
    }

    if (historyIndex === -1) {
      setDraft(input)
    }

    setHistoryIndex(nextIndex)
    const nextValue = nextIndex === -1 ? draft : history[nextIndex]
    setInput(nextValue)

    setTimeout(() => {
      const textArea = textareaRef.current?.resizableTextArea?.textArea
      if (textArea == null) {
        return
      }
      const length = nextValue.length
      textArea.setSelectionRange(length, length)
      textArea.focus()
    }, 0)
  }

  const handleSelectCompletion = (item: CompletionItem) => {
    const textArea = textareaRef.current?.resizableTextArea?.textArea
    if (triggerChar == null || textArea == null) {
      return
    }

    const cursorFallback = textArea.selectionStart
    const textBeforeTrigger = input.slice(0, input.lastIndexOf(triggerChar, cursorFallback - 1))
    const textAfterCursor = input.slice(cursorFallback)

    const newValue = `${textBeforeTrigger}${triggerChar}${item.value} ${textAfterCursor}`
    setInput(newValue)
    setShowCompletion(false)

    setTimeout(() => {
      const nextTextArea = textareaRef.current?.resizableTextArea?.textArea
      if (nextTextArea == null) {
        return
      }
      const newCursorPos = textBeforeTrigger.length + triggerChar.length + item.value.length + 1
      nextTextArea.focus()
      nextTextArea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      if (showReferenceActions) {
        event.preventDefault()
        closeReferenceActions({ restoreFocus: true })
        return
      }

      if (showModelSelect) {
        event.preventDefault()
        setShowModelSelect(false)
        queueTextareaFocusRestore()
        return
      }

      if (showEffortSelect) {
        event.preventDefault()
        setShowEffortSelect(false)
        queueTextareaFocusRestore()
        return
      }
    }

    if (isShortcutMatch(event, resolvedSendShortcut, isMac)) {
      event.preventDefault()
      void handleSend()
      return
    }
    if (
      clearInputShortcut != null &&
      clearInputShortcut.trim() !== '' &&
      isShortcutMatch(event, clearInputShortcut, isMac)
    ) {
      event.preventDefault()
      clearInputValue()
      return
    }
    if (showCompletion) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedIndex(prev => (prev + 1) % completionItems.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedIndex(prev => (prev - 1 + completionItems.length) % completionItems.length)
        return
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        const selectedItem = completionItems[selectedIndex]
        if (selectedItem != null) {
          handleSelectCompletion(selectedItem)
        }
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setShowCompletion(false)
        return
      }
    }

    if (event.key === 'ArrowUp') {
      const textarea = event.target as HTMLTextAreaElement
      const cursorPosition = textarea.selectionStart
      const textBeforeCursor = textarea.value.substring(0, cursorPosition)

      if (!textBeforeCursor.includes('\n')) {
        const history = loadChatHistory()
        const currentHistoryValue = historyIndex === -1 ? null : history[historyIndex]

        if (input.trim() === '' || input === currentHistoryValue) {
          event.preventDefault()
          handleHistoryNavigation('up')
          return
        }
      }
    }

    if (event.key === 'ArrowDown') {
      const textarea = event.target as HTMLTextAreaElement
      const cursorPosition = textarea.selectionEnd
      const textAfterCursor = textarea.value.substring(cursorPosition)

      if (!textAfterCursor.includes('\n')) {
        const history = loadChatHistory()
        const currentHistoryValue = historyIndex === -1 ? null : history[historyIndex]

        if (historyIndex !== -1 || input === currentHistoryValue) {
          event.preventDefault()
          handleHistoryNavigation('down')
          return
        }
      }
    }

    if (event.key === 'Escape') {
      if (isInlineEdit && input === '' && pendingImages.length === 0 && pendingFiles.length === 0 && onCancel != null) {
        event.preventDefault()
        onCancel()
        return
      }
      if (input !== '') {
        event.preventDefault()
        clearInputValue()
      }
      return
    }

    if (event.key === 'l' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      if (isInlineEdit) {
        resetComposer()
        return
      }
      setInput('')
      setHistoryIndex(-1)
      if (onClear != null) {
        onClear()
      } else {
        void message.info('Clear screen is not supported in this context')
      }
      return
    }

    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      void handleSend()
    }
  }

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value
    setInput(value)

    const cursor = event.target.selectionStart
    const charBeforeCursor = value[cursor - 1]

    if (['/', '@', '#'].includes(charBeforeCursor)) {
      setTriggerChar(charBeforeCursor)
      let items: CompletionItem[] = []

      if (sessionInfo?.type === 'init') {
        if (charBeforeCursor === '/') {
          items = (sessionInfo.slashCommands != null ? sessionInfo.slashCommands : []).map((command: string) => ({
            label: `/${command}`,
            value: command,
            icon: 'terminal'
          }))
        } else if (charBeforeCursor === '@') {
          items = (sessionInfo.agents != null ? sessionInfo.agents : []).map((agent: string) => ({
            label: `@${agent}`,
            value: agent,
            icon: 'smart_toy'
          }))
        } else if (charBeforeCursor === '#') {
          items = (sessionInfo.tools != null ? sessionInfo.tools : []).map((tool: string) => ({
            label: `#${tool}`,
            value: tool,
            icon: 'check_box'
          }))
        }
      }

      if (items.length > 0) {
        setCompletionItems(items)
        setSelectedIndex(0)
        setShowCompletion(true)
      } else {
        setShowCompletion(false)
      }
    } else if (showCompletion && !value.includes(triggerChar ?? '')) {
      setShowCompletion(false)
    }
  }

  const permissionContext = interactionRequest?.payload.kind === 'permission'
    ? interactionRequest.payload.permissionContext
    : undefined
  const hideSender = isInlineEdit ? false : shouldHideSenderForInteraction(interactionRequest)
  const deniedTools = permissionContext?.deniedTools?.filter(tool => tool.trim() !== '') ?? []
  const reasons = permissionContext?.reasons?.filter(reason => reason.trim() !== '') ?? []

  useEffect(() => {
    if (!showModelSelect && modelSearchValue !== '') {
      setModelSearchValue('')
    }
  }, [modelSearchValue, showModelSelect])

  const composerControlShortcuts = useComposerControlShortcuts({
    enabled: !hideSender && !showContextPicker && !isInlineEdit,
    isMac,
    shortcuts: mergedShortcuts,
    onSwitchModel: (event) => {
      event.preventDefault()
      event.stopPropagation()
      openModelSelector()
    },
    onSwitchEffort: (event) => {
      event.preventDefault()
      event.stopPropagation()
      openEffortSelector()
    },
    onSwitchPermissionMode: (event) => {
      event.preventDefault()
      event.stopPropagation()
      openPermissionShortcutMenu()
    }
  })

  return (
    <div
      className={[
        'chat-input-wrapper',
        hideSender ? 'chat-input-wrapper--permission' : '',
        isInlineEdit ? 'chat-input-wrapper--inline-edit' : ''
      ].filter(Boolean).join(' ')}
    >
      {isThinking && <ThinkingStatus />}
      {!isInlineEdit && interactionRequest != null && (
        <SenderInteractionPanel
          interactionRequest={interactionRequest}
          permissionContext={permissionContext}
          deniedTools={deniedTools}
          reasons={reasons}
          onInteractionResponse={onInteractionResponse}
        />
      )}
      {!hideSender && (
        <div className={`chat-input-container ${isInlineEdit ? 'chat-input-container--inline-edit' : ''}`.trim()}>
          {!isInlineEdit && connectionError && connectionError.trim() !== '' && (
            <div className='connection-error-banner'>
              <div className='connection-error-content'>
                <span className='material-symbols-rounded'>error</span>
                <div className='connection-error-copy'>
                  <div className='connection-error-title'>{t('chat.connectionErrorTitle')}</div>
                  <div className='connection-error-message'>{connectionError}</div>
                </div>
              </div>
              <Button size='small' onClick={onRetryConnection}>
                {t('chat.retryConnection')}
              </Button>
            </div>
          )}
          {!isInlineEdit && modelUnavailable && (
            <div className='model-unavailable'>
              {t('chat.modelConfigRequired')}
            </div>
          )}
          <SenderAttachments
            pendingImages={pendingImages}
            pendingFiles={pendingFiles}
            onRemovePendingImage={(id) => {
              setPendingImages(prev => prev.filter(image => image.id !== id))
            }}
            onRemovePendingFile={(path) => {
              setPendingFiles(prev => prev.filter(file => file.path !== path))
            }}
          />
          {showCompletion && (
            <CompletionMenu
              items={completionItems}
              selectedIndex={selectedIndex}
              onSelect={handleSelectCompletion}
              onClose={() => setShowCompletion(false)}
            />
          )}
          <TextArea
            ref={textareaRef}
            className='chat-input-textarea'
            placeholder={placeholder ?? interactionRequest?.payload.question ?? t('chat.inputPlaceholder')}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            autoSize={{ minRows: 1, maxRows: 10 }}
            variant='borderless'
            disabled={(!isInlineEdit && modelUnavailable) || isBusy}
          />
          <SenderToolbar
            state={{
              isInlineEdit,
              isThinking,
              modelUnavailable: Boolean(modelUnavailable),
              adapterLocked,
              submitLoading,
              supportsEffort,
              canOpenReferenceActions,
              showModelSelect,
              showEffortSelect,
              showReferenceActions,
              showPermissionActions,
              modelSearchValue,
              selectedModel,
              effort,
              permissionMode,
              selectedAdapter,
              isMac,
              resolvedSendShortcut,
              hasComposerContent: input.trim() !== '' || pendingImages.length > 0 || pendingFiles.length > 0,
              hasSendText: input.trim() !== ''
            }}
            data={{
              modelMenuGroups,
              modelSearchOptions,
              recommendedModelOptions,
              effortOptions,
              permissionModeOptions,
              adapterOptions,
              composerControlShortcuts,
              submitLabel
            }}
            refs={{
              fileInputRef,
              modelSelectRef,
              effortSelectRef,
              referenceMenuNavigation,
              permissionMenuNavigation
            }}
            handlers={{
              onImageFileChange: handleImageFileChange,
              onReferenceOpenChange: handleReferenceOpenChange,
              onShowModelSelectChange: setShowModelSelect,
              onShowEffortSelectChange: setShowEffortSelect,
              onShowPermissionActionsChange: setShowPermissionActions,
              onModelSearchValueChange: setModelSearchValue,
              onOpenContextPicker: handleOpenContextPicker,
              onReferenceImageSelect: handleReferenceImageSelect,
              onSelectPermissionMode: handlePermissionModeSelect,
              onReferenceMenuKeyDown: handleReferenceMenuKeyDown,
              onPermissionMenuKeyDown: handlePermissionMenuKeyDown,
              onOpenModelSelector: openModelSelector,
              onOpenEffortSelector: openEffortSelector,
              onQueueTextareaFocusRestore: queueTextareaFocusRestore,
              onCloseReferenceActions: () => {
                closeReferenceActions()
              },
              onModelChange,
              onEffortChange,
              onAdapterChange,
              onSend: () => {
                void handleSend()
              },
              onInterrupt,
              onCancel
            }}
          />
          {!isInlineEdit && (
            <ContextFilePicker
              open={showContextPicker}
              selectedPaths={pendingFiles.map(file => file.path)}
              onCancel={() => {
                setShowContextPicker(false)
                queueTextareaFocusRestore()
              }}
              onConfirm={handleContextPickerConfirm}
            />
          )}
        </div>
      )}
    </div>
  )
}
