import './Sender.scss'

import { App, Button, Input, Menu, Popover, Select, Tooltip } from 'antd'
import type { MenuProps, RefSelectProps } from 'antd'
import type { TextAreaRef } from 'antd/es/input/TextArea'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import { ShortcutTooltip } from '#~/components/ShortcutTooltip'
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
import { ThinkingStatus } from './ThinkingStatus'
import { buildMessageContent, getInitialComposerState } from './content-attachments'
import { shouldHideSenderForInteraction } from './interaction-request'

const { TextArea } = Input
type SenderVariant = 'default' | 'inline-edit'

type SenderInitialContent = string | ChatMessageContent[] | undefined

type SenderSubmitResult = boolean | void
type ReferenceMenuKey = 'image' | 'file' | 'permission'
type MenuFocusTarget = 'reference' | 'permission' | null

const renderSelectArrow = (onMouseDown: (event: React.MouseEvent<HTMLSpanElement>) => void) => (
  <span className='material-symbols-rounded sender-select-arrow' onMouseDown={onMouseDown}>
    keyboard_arrow_down
  </span>
)
const effortIconMap: Record<ChatEffort, string> = {
  default: 'auto_awesome',
  low: 'signal_cellular_alt_1_bar',
  medium: 'signal_cellular_alt_2_bar',
  high: 'signal_cellular_alt',
  max: 'bolt'
}
const permissionModeIconMap: Record<PermissionMode, string> = {
  default: 'tune',
  acceptEdits: 'edit_note',
  plan: 'checklist',
  dontAsk: 'verified_user',
  bypassPermissions: 'shield_lock'
}

const isActivationKey = (key: string) => key === 'Enter' || key === ' '
const isSelectArrowTarget = (target: EventTarget | null) => {
  return target instanceof HTMLElement && target.closest('.ant-select-arrow') != null
}

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
  initialContent?: string | ChatMessageContent[]
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
  const [input, setInput] = useState(() => getInitialComposerState(initialContent).input)
  const [showCompletion, setShowCompletion] = useState(false)
  const [completionItems, setCompletionItems] = useState<CompletionItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [triggerChar, setTriggerChar] = useState<string | null>(null)

  const [showModelSelect, setShowModelSelect] = useState(false)
  const [showEffortSelect, setShowEffortSelect] = useState(false)
  const [showReferenceActions, setShowReferenceActions] = useState(false)
  const [showPermissionActions, setShowPermissionActions] = useState(false)
  const [modelSearchValue, setModelSearchValue] = useState('')
  const [shouldRestoreFocus, setShouldRestoreFocus] = useState(false)
  const [menuFocusTarget, setMenuFocusTarget] = useState<MenuFocusTarget>(null)
  const [showContextPicker, setShowContextPicker] = useState(false)
  const textareaRef = useRef<TextAreaRef>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const modelSelectRef = useRef<RefSelectProps>(null)
  const effortSelectRef = useRef<RefSelectProps>(null)
  const referenceTriggerRef = useRef<HTMLDivElement>(null)
  const focusRestoreTimeoutRef = useRef<number | null>(null)
  const isMac = navigator.platform.includes('Mac')
  const [pendingImages, setPendingImages] = useState(() => getInitialComposerState(initialContent).pendingImages)
  const [pendingFiles, setPendingFiles] = useState(() => getInitialComposerState(initialContent).pendingFiles)

  const { data: configRes } = useSWR<ConfigResponse>('/api/config')
  const mergedShortcuts = configRes?.sources?.merged?.shortcuts
  const sendShortcut = mergedShortcuts?.sendMessage
  const clearInputShortcut = mergedShortcuts?.clearInput
  const resolvedSendShortcut = sendShortcut != null && sendShortcut.trim() !== ''
    ? sendShortcut
    : 'mod+enter'

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
    setShouldRestoreFocus(false)
    setMenuFocusTarget(null)
    setShowContextPicker(false)
  }, [initialContent])

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

  useEffect(() => {
    return () => {
      if (focusRestoreTimeoutRef.current != null) {
        window.clearTimeout(focusRestoreTimeoutRef.current)
      }
    }
  }, [])

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

  const [historyIndex, setHistoryIndex] = useState(-1)
  const [draft, setDraft] = useState('')

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

  const readFileAsDataUrl = (file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        resolve(typeof reader.result === 'string' ? reader.result : '')
      }
      reader.onerror = () => {
        reject(new Error('read_failed'))
      }
      reader.readAsDataURL(file)
    })
  }

  const addImageFiles = async (files: File[]) => {
    const maxSize = 5 * 1024 * 1024
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue
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
      } catch (err) {
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

  const focusTextarea = () => {
    if (focusRestoreTimeoutRef.current != null) {
      window.clearTimeout(focusRestoreTimeoutRef.current)
    }

    focusRestoreTimeoutRef.current = window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        const textArea = textareaRef.current?.resizableTextArea?.textArea
        if (textArea == null || textArea.disabled) {
          return
        }

        const length = textArea.value.length
        textArea.focus()
        textArea.setSelectionRange(length, length)
      })
    }, 80)
  }

  const queueTextareaFocusRestore = () => {
    setShouldRestoreFocus(true)
  }

  useEffect(() => {
    if (!shouldRestoreFocus || showModelSelect || showEffortSelect || showReferenceActions || showContextPicker) {
      return
    }

    const timer = window.setTimeout(() => {
      focusTextarea()
      setShouldRestoreFocus(false)
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [shouldRestoreFocus, showContextPicker, showEffortSelect, showModelSelect, showReferenceActions])

  useEffect(() => {
    if (!showModelSelect && modelSearchValue !== '') {
      setModelSearchValue('')
    }
  }, [modelSearchValue, showModelSelect])

  const handleSend = async () => {
    if (isBusy) return
    if (input.trim() === '' && pendingImages.length === 0 && pendingFiles.length === 0) return

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
    } else {
      if (isInlineEdit) {
        const result = await onSend(input)
        didSubmit = result !== false
      } else {
        void onSend(input)
      }
    }

    if (!didSubmit) {
      return
    }

    // Save to local storage history
    try {
      const history = JSON.parse(localStorage.getItem('vf_chat_history') ?? '[]') as string[]
      const newHistory = [input, ...history.filter((h: string) => h !== input)].slice(0, 50)
      localStorage.setItem('vf_chat_history', JSON.stringify(newHistory))
    } catch (e) {
      console.error('Failed to save chat history', e)
    }

    resetComposer()
  }

  const handleImageUpload = () => {
    if (isBusy) return
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
    if (fileList.length === 0) return
    await addImageFiles(fileList)
    event.target.value = ''
  }

  const handleRemovePendingImage = (id: string) => {
    setPendingImages(prev => prev.filter(img => img.id !== id))
  }

  const handleRemovePendingFile = (path: string) => {
    setPendingFiles(prev => prev.filter(file => file.path !== path))
  }

  const handleOpenContextPicker = () => {
    if (isBusy || isInlineEdit) return
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

  const toggleModelSelectorFromArrow = (event: React.MouseEvent<HTMLSpanElement>) => {
    event.preventDefault()
    event.stopPropagation()

    if (showModelSelect) {
      setShowModelSelect(false)
      queueTextareaFocusRestore()
      return
    }

    openModelSelector()
  }

  const toggleEffortSelectorFromArrow = (event: React.MouseEvent<HTMLSpanElement>) => {
    event.preventDefault()
    event.stopPropagation()

    if (showEffortSelect) {
      setShowEffortSelect(false)
      queueTextareaFocusRestore()
      return
    }

    openEffortSelector()
  }

  const handleModelBodyTriggerMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    openModelSelector()
  }

  const handleEffortBodyTriggerMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    openEffortSelector()
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
  }, [showEffortSelect, showModelSelect, showReferenceActions])

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
    if (input === '') return
    setInput('')
    setHistoryIndex(-1)
  }

  const handleHistoryNavigation = (direction: 'up' | 'down') => {
    try {
      const history = JSON.parse(localStorage.getItem('vf_chat_history') ?? '[]') as string[]
      if (history.length === 0) return

      let nextIndex = historyIndex
      if (direction === 'up') {
        nextIndex = Math.min(historyIndex + 1, history.length - 1)
      } else {
        nextIndex = Math.max(historyIndex - 1, -1)
      }

      if (nextIndex !== historyIndex) {
        // Save draft when leaving -1
        if (historyIndex === -1) {
          setDraft(input)
        }

        setHistoryIndex(nextIndex)
        const nextValue = nextIndex === -1 ? draft : history[nextIndex]
        setInput(nextValue)

        // Set cursor to the end of the text
        setTimeout(() => {
          if (textareaRef.current?.resizableTextArea?.textArea != null) {
            const textArea = textareaRef.current.resizableTextArea.textArea
            const length = nextValue.length
            textArea.setSelectionRange(length, length)
            textArea.focus()
          }
        }, 0)
      }
    } catch (e) {
      console.error('Failed to navigate chat history', e)
    }
  }

  const handleSelectCompletion = (item: CompletionItem) => {
    if (triggerChar == null || textareaRef.current?.resizableTextArea?.textArea == null) return

    const textArea = textareaRef.current.resizableTextArea.textArea
    const cursorFallback = textArea.selectionStart
    const textBeforeTrigger = input.slice(0, input.lastIndexOf(triggerChar, cursorFallback - 1))
    const textAfterCursor = input.slice(cursorFallback)

    const newValue = `${textBeforeTrigger}${triggerChar}${item.value} ${textAfterCursor}`
    setInput(newValue)
    setShowCompletion(false)

    // Focus back and set cursor
    setTimeout(() => {
      if (textareaRef.current?.resizableTextArea?.textArea != null) {
        const textArea = textareaRef.current.resizableTextArea.textArea
        const newCursorPos = textBeforeTrigger.length + triggerChar.length + item.value.length + 1
        textArea.focus()
        textArea.setSelectionRange(newCursorPos, newCursorPos)
      }
    }, 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (showReferenceActions) {
        e.preventDefault()
        closeReferenceActions({ restoreFocus: true })
        return
      }

      if (showModelSelect) {
        e.preventDefault()
        setShowModelSelect(false)
        queueTextareaFocusRestore()
        return
      }

      if (showEffortSelect) {
        e.preventDefault()
        setShowEffortSelect(false)
        queueTextareaFocusRestore()
        return
      }
    }

    if (isShortcutMatch(e, resolvedSendShortcut, isMac)) {
      e.preventDefault()
      handleSend()
      return
    }
    if (
      clearInputShortcut != null && clearInputShortcut.trim() !== '' && isShortcutMatch(e, clearInputShortcut, isMac)
    ) {
      e.preventDefault()
      clearInputValue()
      return
    }
    if (showCompletion) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % completionItems.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + completionItems.length) % completionItems.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const selectedItem = completionItems[selectedIndex]
        if (selectedItem != null) {
          handleSelectCompletion(selectedItem)
        }
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowCompletion(false)
        return
      }
    }

    // History navigation logic
    if (e.key === 'ArrowUp') {
      const textarea = e.target as HTMLTextAreaElement
      const cursorPosition = textarea.selectionStart
      const textBeforeCursor = textarea.value.substring(0, cursorPosition)

      // Only navigate if cursor is at the first line
      if (!textBeforeCursor.includes('\n')) {
        const historyJson = localStorage.getItem('vf_chat_history')
        const history = (historyJson != null ? JSON.parse(historyJson) : []) as string[]
        const currentHistoryValue = historyIndex === -1 ? null : history[historyIndex]

        // If content is empty OR content matches the current history entry, allow navigation
        if (input.trim() === '' || input === currentHistoryValue) {
          e.preventDefault()
          handleHistoryNavigation('up')
          return
        }
      }
    }

    if (e.key === 'ArrowDown') {
      const textarea = e.target as HTMLTextAreaElement
      const cursorPosition = textarea.selectionEnd
      const textAfterCursor = textarea.value.substring(cursorPosition)

      // Only navigate if cursor is at the last line
      if (!textAfterCursor.includes('\n')) {
        const historyJson = localStorage.getItem('vf_chat_history')
        const history = (historyJson != null ? JSON.parse(historyJson) : []) as string[]
        const currentHistoryValue = historyIndex === -1 ? null : history[historyIndex]

        // If history navigation has started (index >= 0) OR content matches current history entry
        if (historyIndex !== -1 || input === currentHistoryValue) {
          e.preventDefault()
          handleHistoryNavigation('down')
          return
        }
      }
    }

    // More shortcuts
    if (e.key === 'Escape') {
      if (isInlineEdit && input === '' && pendingImages.length === 0 && pendingFiles.length === 0 && onCancel != null) {
        e.preventDefault()
        onCancel()
        return
      }
      if (input !== '') {
        e.preventDefault()
        clearInputValue()
      }
      return
    }

    // Cmd/Ctrl + L to clear screen
    if (e.key === 'l' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
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

    // Cmd/Ctrl + Enter to send
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setInput(value)

    const cursor = e.target.selectionStart
    const charBeforeCursor = value[cursor - 1]

    if (['/', '@', '#'].includes(charBeforeCursor)) {
      setTriggerChar(charBeforeCursor)
      let items: CompletionItem[] = []

      if (sessionInfo?.type === 'init') {
        const info = sessionInfo
        if (charBeforeCursor === '/') {
          items = (info.slashCommands != null ? info.slashCommands : []).map((cmd: string) => ({
            label: `/${cmd}`,
            value: cmd,
            icon: 'terminal'
          }))
        } else if (charBeforeCursor === '@') {
          items = (info.agents != null ? info.agents : []).map((agent: string) => ({
            label: `@${agent}`,
            value: agent,
            icon: 'smart_toy'
          }))
        } else if (charBeforeCursor === '#') {
          items = (info.tools != null ? info.tools : []).map((tool: string) => ({
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
    } else if (showCompletion) {
      // Filter logic could go here if needed
      if (!value.includes(triggerChar ?? '')) {
        setShowCompletion(false)
      }
    }
  }

  const permissionContext = interactionRequest?.payload.kind === 'permission'
    ? interactionRequest.payload.permissionContext
    : undefined
  const hideSender = isInlineEdit ? false : shouldHideSenderForInteraction(interactionRequest)
  const deniedTools = permissionContext?.deniedTools?.filter(tool => tool.trim() !== '') ?? []
  const reasons = permissionContext?.reasons?.filter(reason => reason.trim() !== '') ?? []
  const canOpenReferenceActions = !isBusy && (!modelUnavailable || isInlineEdit)
  const selectedPermissionOption = permissionModeOptions.find(option => option.value === permissionMode)
  const decoratedEffortOptions = effortOptions.map(option => ({
    ...option,
    label: (
      <span className={`effort-option effort-option--${option.value}`.trim()}>
        <span className='material-symbols-rounded effort-option__icon'>{effortIconMap[option.value]}</span>
        <span className='effort-option__text'>
          {option.value === 'default' ? t('chat.effortLabels.default') : t(`chat.effortLabels.${option.value}`)}
        </span>
      </span>
    )
  }))
  const hasModelSearchQuery = modelSearchValue.trim() !== ''

  const handleModelSelection = (value: string) => {
    onModelChange?.(value)
    setShowModelSelect(false)
    setModelSearchValue('')
    queueTextareaFocusRestore()
  }

  const handleModelMenuClick: MenuProps['onClick'] = ({ key, domEvent }) => {
    domEvent.preventDefault()
    if (typeof key !== 'string' || key === 'more-models') return
    handleModelSelection(key)
  }

  const renderModelMenuTooltip = useCallback((description?: string) => {
    if (!description) {
      return null
    }

    return (
      <span className='model-menu-tooltip-content'>
        {description}
      </span>
    )
  }, [])

  const renderCompactModelMenuLabel = useCallback((option: ModelSelectOption) => {
    const label = (
      <span className='model-select-menu-item-label'>
        <span className='model-select-menu-item-title'>{option.displayLabel}</span>
      </span>
    )

    if (!option.description) {
      return label
    }

    return (
      <Tooltip
        title={renderModelMenuTooltip(option.description)}
        placement='left'
        classNames={{ root: 'model-menu-tooltip' }}
        mouseEnterDelay={.35}
        destroyOnHidden
      >
        {label}
      </Tooltip>
    )
  }, [renderModelMenuTooltip])

  const renderModelMenuGroupLabel = useCallback((group: ModelSelectMenuGroup) => {
    const label = (
      <span className='model-menu-group-label'>
        <span className='model-menu-group-title'>{group.title}</span>
      </span>
    )

    if (!group.description) {
      return label
    }

    return (
      <Tooltip
        title={renderModelMenuTooltip(group.description)}
        placement='left'
        classNames={{ root: 'model-menu-tooltip' }}
        mouseEnterDelay={.35}
        destroyOnHidden
      >
        {label}
      </Tooltip>
    )
  }, [renderModelMenuTooltip])

  const modelMenuItems = useMemo<MenuProps['items']>(() => {
    const recommendedItems = (recommendedModelOptions ?? []).map(option => ({
      key: option.value,
      label: renderCompactModelMenuLabel(option),
      className: 'model-select-menu-item'
    }))

    const moreModelChildren = (modelMenuGroups ?? [])
      .filter(group => group.options.length > 0)
      .map(group => ({
        key: group.key,
        label: renderModelMenuGroupLabel(group),
        popupClassName: 'model-select-submenu-popup',
        children: group.options.map(option => ({
          key: option.value,
          label: renderCompactModelMenuLabel(option),
          className: 'model-select-menu-item'
        }))
      }))

    if (moreModelChildren.length === 0) {
      return recommendedItems
    }

    return [
      ...recommendedItems,
      {
        key: 'more-models',
        label: <span className='model-more-menu-label'>{t('chat.modelMoreModels')}</span>,
        popupClassName: 'model-select-submenu-popup',
        children: moreModelChildren
      }
    ]
  }, [modelMenuGroups, recommendedModelOptions, renderCompactModelMenuLabel, renderModelMenuGroupLabel, t])

  const renderModelPopup = (menu: React.ReactElement) => {
    if (hasModelSearchQuery || modelMenuItems == null || modelMenuItems.length === 0) {
      return menu
    }

    return (
      <div
        className='model-select-browser'
        onMouseDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
      >
        <Menu
          className='model-select-menu'
          mode='vertical'
          selectable
          selectedKeys={selectedModel ? [selectedModel] : []}
          triggerSubMenuAction='hover'
          items={modelMenuItems}
          onClick={handleModelMenuClick}
        />
      </div>
    )
  }

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
        <div className='interaction-panel'>
          {permissionContext != null && (
            <div className='interaction-panel__badge'>
              <span className='material-symbols-rounded'>lock</span>
              <span>{t('chat.permissionRequestBadge')}</span>
            </div>
          )}
          <div className='interaction-question'>
            {interactionRequest.payload.question}
          </div>
          {permissionContext != null && (
            <div className='interaction-panel__context'>
              <div className='interaction-panel__meta'>
                {permissionContext.currentMode != null && (
                  <div className='interaction-panel__meta-item'>
                    <span className='interaction-panel__meta-label'>{t('chat.permissionCurrentMode')}</span>
                    <code>{permissionContext.currentMode}</code>
                  </div>
                )}
                {permissionContext.suggestedMode != null && (
                  <div className='interaction-panel__meta-item'>
                    <span className='interaction-panel__meta-label'>{t('chat.permissionSuggestedMode')}</span>
                    <code>{permissionContext.suggestedMode}</code>
                  </div>
                )}
              </div>
              {deniedTools.length > 0 && (
                <div className='interaction-panel__section'>
                  <div className='interaction-panel__section-title'>{t('chat.permissionDeniedTools')}</div>
                  <div className='interaction-panel__chips'>
                    {deniedTools.map((tool: string) => (
                      <code key={tool} className='interaction-panel__chip'>{tool}</code>
                    ))}
                  </div>
                </div>
              )}
              {reasons.length > 0 && (
                <div className='interaction-panel__section'>
                  <div className='interaction-panel__section-title'>{t('chat.permissionReasons')}</div>
                  <div className='interaction-panel__reasons'>
                    {reasons.map((reason: string) => (
                      <div key={reason} className='interaction-panel__reason'>{reason}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {interactionRequest.payload.options?.map((option: NonNullable<AskUserQuestionParams['options']>[number]) => (
            <Button
              key={option.value ?? option.label}
              block
              className='interaction-panel__option'
              onClick={() => onInteractionResponse?.(interactionRequest.id, option.value ?? option.label)}
            >
              <div className='interaction-panel__option-label'>{option.label}</div>
              {option.description && (
                <div className='interaction-panel__option-description'>
                  {option.description}
                </div>
              )}
            </Button>
          ))}
        </div>
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
          {pendingImages.length > 0 && (
            <div className='pending-images'>
              {pendingImages.map(img => (
                <div key={img.id} className='pending-image'>
                  <img src={img.url} alt={img.name ?? 'image'} />
                  <div className='pending-image-remove' onClick={() => handleRemovePendingImage(img.id)}>
                    <span className='material-symbols-rounded'>close</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {pendingFiles.length > 0 && (
            <div className='pending-context-files'>
              {pendingFiles.map(file => (
                <div key={file.path} className='pending-context-file'>
                  <div className='pending-context-file__meta'>
                    <span className='material-symbols-rounded pending-context-file__icon'>description</span>
                    <code className='pending-context-file__path'>{file.path}</code>
                  </div>
                  <div className='pending-context-file__remove' onClick={() => handleRemovePendingFile(file.path)}>
                    <span className='material-symbols-rounded'>close</span>
                  </div>
                </div>
              ))}
            </div>
          )}
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

          <div className='chat-input-toolbar'>
            <input
              ref={fileInputRef}
              type='file'
              accept='image/*'
              multiple
              onChange={handleImageFileChange}
              className='file-input-hidden'
            />
            <div className='toolbar-left'>
              <Popover
                content={
                  <div className='reference-actions-menu'>
                    <button
                      ref={referenceMenuNavigation.registerItem('image')}
                      type='button'
                      className='reference-actions-menu-item'
                      onMouseEnter={() => {
                        referenceMenuNavigation.setActiveKey('image')
                        setShowPermissionActions(false)
                      }}
                      onFocus={() => referenceMenuNavigation.setActiveKey('image')}
                      onKeyDown={(event) => handleReferenceMenuKeyDown(event, 'image')}
                      onClick={() => {
                        handleReferenceImageSelect()
                      }}
                    >
                      <span className='reference-action-option'>
                        <span className='material-symbols-rounded reference-action-option__icon'>image</span>
                        <span className='reference-action-option__label'>{t('chat.referenceImage')}</span>
                      </span>
                    </button>
                    {!isInlineEdit && (
                      <button
                        ref={referenceMenuNavigation.registerItem('file')}
                        type='button'
                        className='reference-actions-menu-item'
                        onMouseEnter={() => {
                          referenceMenuNavigation.setActiveKey('file')
                          setShowPermissionActions(false)
                        }}
                        onFocus={() => referenceMenuNavigation.setActiveKey('file')}
                        onKeyDown={(event) => handleReferenceMenuKeyDown(event, 'file')}
                        onClick={() => {
                          closeReferenceActions()
                          handleOpenContextPicker()
                        }}
                      >
                        <span className='reference-action-option'>
                          <span className='material-symbols-rounded reference-action-option__icon'>description</span>
                          <span className='reference-action-option__label'>{t('chat.referenceFile')}</span>
                        </span>
                      </button>
                    )}
                    {!isInlineEdit && permissionModeOptions.length > 0 && (
                      <Popover
                        content={
                          <div className='reference-actions-menu reference-actions-menu--submenu'>
                            {permissionModeOptions.map(option => (
                              <button
                                key={option.value}
                                ref={permissionMenuNavigation.registerItem(option.value)}
                                type='button'
                                className={`reference-actions-menu-item ${
                                  permissionMode === option.value ? 'is-selected' : ''
                                }`.trim()}
                                onMouseEnter={() => permissionMenuNavigation.setActiveKey(option.value)}
                                onFocus={() => permissionMenuNavigation.setActiveKey(option.value)}
                                onKeyDown={(event) => handlePermissionMenuKeyDown(event, option.value)}
                                onClick={() => {
                                  handlePermissionModeSelect(option.value)
                                }}
                              >
                                <span className='reference-action-option reference-action-option--permission'>
                                  <span className='material-symbols-rounded reference-action-option__icon'>
                                    {permissionModeIconMap[option.value]}
                                  </span>
                                  <span className='reference-action-option__label'>{option.label}</span>
                                  {permissionMode === option.value && (
                                    <span className='material-symbols-rounded reference-action-option__check'>
                                      check
                                    </span>
                                  )}
                                </span>
                              </button>
                            ))}
                          </div>
                        }
                        open={showReferenceActions ? showPermissionActions : false}
                        onOpenChange={(nextOpen) => {
                          if (!showReferenceActions) {
                            return
                          }
                          referenceMenuNavigation.setActiveKey('permission')
                          if (nextOpen) {
                            permissionMenuNavigation.setActiveKey(permissionMode)
                          }
                          setShowPermissionActions(nextOpen)
                        }}
                        placement='rightTop'
                        trigger={['hover', 'click']}
                        classNames={{ root: 'reference-actions-submenu-popover' }}
                        destroyOnHidden
                        arrow={false}
                      >
                        <button
                          ref={referenceMenuNavigation.registerItem('permission')}
                          type='button'
                          className='reference-actions-menu-item reference-actions-menu-item--submenu'
                          onMouseEnter={() => referenceMenuNavigation.setActiveKey('permission')}
                          onFocus={() => referenceMenuNavigation.setActiveKey('permission')}
                          onKeyDown={(event) => handleReferenceMenuKeyDown(event, 'permission')}
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            setShowPermissionActions(prev => !prev)
                          }}
                        >
                          <span className='reference-action-option'>
                            <span className='material-symbols-rounded reference-action-option__icon'>lock</span>
                            <span className='reference-action-option__label'>{t('chat.referencePermission')}</span>
                            <span className='reference-action-option__value'>
                              {selectedPermissionOption?.label}
                            </span>
                            <span className='material-symbols-rounded reference-action-option__chevron'>
                              chevron_right
                            </span>
                          </span>
                        </button>
                      </Popover>
                    )}
                  </div>
                }
                open={showReferenceActions}
                onOpenChange={handleReferenceOpenChange}
                placement='topLeft'
                trigger='click'
                classNames={{ root: 'reference-actions-popover' }}
                destroyOnHidden
                arrow={false}
              >
                <ShortcutTooltip
                  shortcut={composerControlShortcuts.switchPermissionMode}
                  isMac={isMac}
                  title={t('chat.referenceActionsShortcutTooltip')}
                  enabled={!showReferenceActions}
                >
                  <div
                    ref={referenceTriggerRef}
                    className={`toolbar-btn toolbar-btn--reference ${showReferenceActions ? 'active' : ''}`.trim()}
                    tabIndex={-1}
                    onClick={canOpenReferenceActions ? undefined : (event) => {
                      event.preventDefault()
                      void handleReferenceOpenChange(true)
                    }}
                  >
                    <span className='toolbar-btn__icon-shell'>
                      <span className='material-symbols-rounded'>add</span>
                    </span>
                    <span className='toolbar-btn__text'>{t('chat.referenceActionsShort')}</span>
                  </div>
                </ShortcutTooltip>
              </Popover>

              {!isInlineEdit && (
                <ShortcutTooltip
                  shortcut={composerControlShortcuts.switchModel}
                  isMac={isMac}
                  title={t('chat.modelShortcutTooltip')}
                  targetClassName='sender-control-tooltip-target'
                  enabled={!showModelSelect}
                >
                  <div className='sender-select-shell'>
                    {!showModelSelect && !(modelUnavailable || isThinking) && (
                      <button
                        type='button'
                        className='sender-select-body-trigger'
                        aria-label={t('chat.modelShortcutTooltip')}
                        onMouseDown={handleModelBodyTriggerMouseDown}
                      />
                    )}
                    <Select
                      ref={modelSelectRef}
                      className='model-select'
                      classNames={{ popup: { root: 'model-select-popup' } }}
                      open={showModelSelect}
                      value={selectedModel}
                      options={modelSearchOptions ?? []}
                      showSearch
                      searchValue={modelSearchValue}
                      allowClear={false}
                      disabled={modelUnavailable || isThinking}
                      onChange={handleModelSelection}
                      onOpenChange={(nextOpen) => {
                        if (nextOpen) {
                          setShowEffortSelect(false)
                          closeReferenceActions()
                        } else {
                          queueTextareaFocusRestore()
                        }
                        setShowModelSelect(nextOpen)
                      }}
                      onSearch={setModelSearchValue}
                      placeholder={modelUnavailable ? t('chat.modelUnavailable') : t('chat.modelSelectPlaceholder')}
                      optionLabelProp='displayLabel'
                      filterOption={(input, option) => {
                        const searchText = String((option as ModelSelectOption | undefined)?.searchText ?? '')
                        return searchText.toLowerCase().includes(input.toLowerCase())
                      }}
                      popupRender={renderModelPopup}
                      popupMatchSelectWidth={false}
                      suffixIcon={renderSelectArrow(toggleModelSelectorFromArrow)}
                    />
                  </div>
                </ShortcutTooltip>
              )}

              {!isInlineEdit && supportsEffort && (
                <ShortcutTooltip
                  shortcut={composerControlShortcuts.switchEffort}
                  isMac={isMac}
                  title={t('chat.effortShortcutTooltip')}
                  targetClassName='sender-control-tooltip-target'
                  enabled={!showEffortSelect}
                >
                  <div className='sender-select-shell'>
                    {!showEffortSelect && !(modelUnavailable || isThinking) && (
                      <button
                        type='button'
                        className='sender-select-body-trigger'
                        aria-label={t('chat.effortShortcutTooltip')}
                        onMouseDown={handleEffortBodyTriggerMouseDown}
                      />
                    )}
                    <Select
                      ref={effortSelectRef}
                      className='effort-select'
                      classNames={{ popup: { root: 'effort-select-popup' } }}
                      open={showEffortSelect}
                      value={effort}
                      options={decoratedEffortOptions}
                      showSearch={false}
                      allowClear={false}
                      disabled={modelUnavailable || isThinking}
                      onChange={(value) => {
                        onEffortChange?.(value)
                        setShowEffortSelect(false)
                        queueTextareaFocusRestore()
                      }}
                      onOpenChange={(nextOpen) => {
                        if (nextOpen) {
                          setShowModelSelect(false)
                          closeReferenceActions()
                        } else {
                          queueTextareaFocusRestore()
                        }
                        setShowEffortSelect(nextOpen)
                      }}
                      placeholder={t('chat.effortSelectPlaceholder')}
                      optionLabelProp='label'
                      popupMatchSelectWidth={false}
                      suffixIcon={renderSelectArrow(toggleEffortSelectorFromArrow)}
                    />
                  </div>
                </ShortcutTooltip>
              )}
            </div>

            <div className={`toolbar-right ${isInlineEdit ? 'toolbar-right--inline-edit' : ''}`.trim()}>
              {!isInlineEdit && adapterOptions && adapterOptions.length > 1 && (
                <Tooltip
                  title={adapterLocked ? t('chat.adapterLockedTooltip') : undefined}
                  placement='top'
                >
                  <span className='adapter-select-tooltip-target'>
                    <Select
                      className={`adapter-select ${adapterLocked ? 'adapter-select--locked' : ''}`.trim()}
                      classNames={{ popup: { root: 'adapter-select-popup' } }}
                      value={selectedAdapter}
                      options={adapterOptions}
                      showSearch={false}
                      allowClear={false}
                      disabled={adapterLocked || modelUnavailable || isThinking}
                      onChange={(value) => onAdapterChange?.(value)}
                      placeholder={t('chat.adapterSelectPlaceholder', { defaultValue: 'Adapter' })}
                      optionLabelProp='label'
                      popupMatchSelectWidth={false}
                      suffixIcon={null}
                    />
                  </span>
                </Tooltip>
              )}

              {isInlineEdit
                ? (
                  <>
                    {onCancel != null && (
                      <Button
                        autoInsertSpace={false}
                        size='small'
                        disabled={submitLoading}
                        onClick={onCancel}
                      >
                        {t('common.cancel')}
                      </Button>
                    )}
                    <Button
                      autoInsertSpace={false}
                      type='primary'
                      size='small'
                      loading={submitLoading}
                      disabled={input.trim() === '' && pendingImages.length === 0 && pendingFiles.length === 0}
                      onClick={() => {
                        void handleSend()
                      }}
                    >
                      {submitLabel ?? t('chat.send')}
                    </Button>
                  </>
                )
                : (
                  <ShortcutTooltip
                    shortcut={resolvedSendShortcut}
                    isMac={isMac}
                    title={t('chat.sendShortcutTooltip')}
                    targetClassName='sender-control-tooltip-target'
                    enabled={!isThinking}
                  >
                    <div
                      className={`chat-send-btn ${input.trim() !== '' && !modelUnavailable ? 'active' : ''} ${
                        isThinking ? 'thinking' : ''
                      } ${modelUnavailable ? 'disabled' : ''}`}
                      onClick={modelUnavailable ? undefined : (isThinking ? onInterrupt : () => {
                        void handleSend()
                      })}
                    >
                      <span className='material-symbols-rounded'>
                        {isThinking ? 'stop_circle' : 'send'}
                      </span>
                    </div>
                  </ShortcutTooltip>
                )}
            </div>
          </div>
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
