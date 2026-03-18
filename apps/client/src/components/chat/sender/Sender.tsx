import './Sender.scss'

import { App, Button, Cascader, Input, Select, Tooltip } from 'antd'
import type { TextAreaRef } from 'antd/es/input/TextArea'
import React, { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import type { PermissionMode } from '#~/hooks/chat/use-chat-permission-mode'
import type { AskUserQuestionParams, ChatMessageContent, SessionInfo, SessionStatus } from '@vibe-forge/core'
import { isShortcutMatch } from '../../../utils/shortcutUtils'
import type { CompletionItem } from './CompletionMenu'
import { CompletionMenu } from './CompletionMenu'
import { ThinkingStatus } from './ThinkingStatus'

const { TextArea } = Input

interface ModelSelectOption {
  value: string
  label: React.ReactNode
  searchText: string
  displayLabel: string
}

interface ModelSelectGroup {
  label: React.ReactNode
  options: ModelSelectOption[]
}

interface PendingImage {
  id: string
  url: string
  name?: string
  size?: number
  mimeType?: string
}

interface SenderToolGroup {
  key: 'chrome-devtools' | 'system'
  label: string
  tools: string[]
}

interface SenderToolOption {
  value: string
  label: React.ReactNode
  children?: SenderToolOption[]
}

const formatToolLabel = (tool: string) => {
  const parts = tool.split('__')
  return parts[parts.length - 1] || tool
}

const getToolGroupIcon = (groupKey: SenderToolGroup['key']) => {
  return groupKey === 'chrome-devtools' ? 'web_traffic' : 'memory'
}

export function Sender({
  onSend,
  onSendContent,
  sessionStatus,
  onInterrupt,
  onClear,
  sessionInfo,
  connectionError,
  onRetryConnection,
  interactionRequest,
  onInteractionResponse,
  placeholder,
  modelOptions,
  selectedModel,
  onModelChange,
  permissionMode,
  permissionModeOptions,
  onPermissionModeChange,
  selectedAdapter,
  adapterOptions,
  onAdapterChange,
  modelUnavailable
}: {
  onSend: (text: string) => void
  onSendContent: (content: ChatMessageContent[]) => void
  sessionStatus?: SessionStatus
  onInterrupt: () => void
  onClear?: () => void
  sessionInfo?: SessionInfo | null
  connectionError?: string | null
  onRetryConnection?: () => void
  interactionRequest?: { id: string; payload: AskUserQuestionParams } | null
  onInteractionResponse?: (id: string, data: string | string[]) => void
  placeholder?: string
  modelOptions?: ModelSelectGroup[]
  selectedModel?: string
  onModelChange?: (model: string) => void
  permissionMode: PermissionMode
  permissionModeOptions: Array<{ value: PermissionMode; label: React.ReactNode }>
  onPermissionModeChange: (mode: PermissionMode) => void
  selectedAdapter?: string
  adapterOptions?: Array<{ value: string; label: React.ReactNode }>
  onAdapterChange?: (adapter: string) => void
  modelUnavailable?: boolean
}) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [input, setInput] = useState('')
  const [showCompletion, setShowCompletion] = useState(false)
  const [completionItems, setCompletionItems] = useState<CompletionItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [triggerChar, setTriggerChar] = useState<string | null>(null)

  const [showToolsList, setShowToolsList] = useState(false)
  const textareaRef = useRef<TextAreaRef>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isMac = navigator.platform.includes('Mac')
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])

  const { data: configRes } = useSWR<{
    sources?: {
      merged?: {
        shortcuts?: {
          sendMessage?: string
          clearInput?: string
        }
      }
    }
  }>('/api/config')
  const sendShortcut = configRes?.sources?.merged?.shortcuts?.sendMessage
  const clearInputShortcut = configRes?.sources?.merged?.shortcuts?.clearInput
  const resolvedSendShortcut = sendShortcut != null && sendShortcut.trim() !== ''
    ? sendShortcut
    : 'mod+enter'

  const isThinking = sessionStatus === 'running'
  const groupedTools: SenderToolGroup[] = sessionInfo != null && sessionInfo.type === 'init'
    ? [
        {
          key: 'chrome-devtools',
          label: t('chat.toolGroupChromeDevtools'),
          tools: sessionInfo.tools.filter(tool => tool.startsWith('mcp__ChromeDevtools__'))
        },
        {
          key: 'system',
          label: t('chat.toolGroupSystem'),
          tools: sessionInfo.tools.filter(tool => !tool.startsWith('mcp__ChromeDevtools__'))
        }
      ].filter(group => group.tools.length > 0)
    : []
  const toolCascaderOptions: SenderToolOption[] = groupedTools.map(group => ({
    value: group.key,
    label: (
      <span className='sender-tool-group-option'>
        <span className='sender-tool-group-option__icon material-symbols-rounded'>{getToolGroupIcon(group.key)}</span>
        <span className='sender-tool-group-option__text'>{group.label}</span>
        <span className='sender-tool-group-option__count'>{group.tools.length}</span>
      </span>
    ),
    children: group.tools.map(tool => ({
      value: tool,
      label: (
        <span className='sender-tool-option'>
          <span className='sender-tool-option__dot' />
          <span className='sender-tool-option__text'>{formatToolLabel(tool)}</span>
        </span>
      )
    }))
  }))

  const [historyIndex, setHistoryIndex] = useState(-1)
  const [draft, setDraft] = useState('')

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

  const handleSend = () => {
    if (isThinking) return
    if (input.trim() === '' && pendingImages.length === 0) return

    if (modelUnavailable) {
      void message.warning(t('chat.modelConfigRequired'))
      return
    }

    if (interactionRequest != null && onInteractionResponse != null) {
      if (pendingImages.length > 0) {
        void message.warning(t('chat.imageNotSupportedInInteraction'))
        return
      }
      onInteractionResponse(interactionRequest.id, input.trim())
      setInput('')
      return
    }

    if (pendingImages.length > 0) {
      const content: ChatMessageContent[] = []
      if (input.trim() !== '') {
        content.push({ type: 'text', text: input.trim() })
      }
      content.push(...pendingImages.map(img => ({
        type: 'image',
        url: img.url,
        name: img.name,
        size: img.size,
        mimeType: img.mimeType
      })))
      onSendContent(content)
    } else {
      onSend(input)
    }

    // Save to local storage history
    try {
      const history = JSON.parse(localStorage.getItem('vf_chat_history') ?? '[]') as string[]
      const newHistory = [input, ...history.filter((h: string) => h !== input)].slice(0, 50)
      localStorage.setItem('vf_chat_history', JSON.stringify(newHistory))
    } catch (e) {
      console.error('Failed to save chat history', e)
    }

    setInput('')
    setPendingImages([])
    setDraft('')
    setShowCompletion(false)
    setHistoryIndex(-1)
  }

  const handleImageUpload = () => {
    if (isThinking) return
    if (modelUnavailable) {
      void message.warning(t('chat.modelConfigRequired'))
      return
    }
    if (interactionRequest != null) {
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

  const handleTriggerClick = (char: string) => {
    if (textareaRef.current?.resizableTextArea?.textArea == null) return
    const textArea = textareaRef.current.resizableTextArea.textArea
    const cursor = textArea.selectionStart
    const textBefore = input.slice(0, cursor)
    const textAfter = input.slice(cursor)

    // Check if we need to add a space before the trigger char
    const needsSpaceBefore = textBefore.length > 0 && !textBefore.endsWith(' ')
    const trigger = needsSpaceBefore ? ` ${char}` : char

    const newValue = textBefore + trigger + textAfter
    setInput(newValue)

    setTimeout(() => {
      if (textareaRef.current?.resizableTextArea?.textArea != null) {
        const textArea = textareaRef.current.resizableTextArea.textArea
        const newPos = cursor + trigger.length
        textArea.focus()
        textArea.setSelectionRange(newPos, newPos)

        // Trigger handleInputChange logic manually
        const event = { target: textArea } as unknown as React.ChangeEvent<HTMLTextAreaElement>
        handleInputChange(event)
      }
    }, 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
      if (input !== '') {
        e.preventDefault()
        clearInputValue()
      }
      return
    }

    // Cmd/Ctrl + L to clear screen
    if (e.key === 'l' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
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
          items = (info.slashCommands != null ? info.slashCommands : []).map(cmd => ({
            label: `/${cmd}`,
            value: cmd,
            icon: 'terminal'
          }))
        } else if (charBeforeCursor === '@') {
          items = (info.agents != null ? info.agents : []).map(agent => ({
            label: `@${agent}`,
            value: agent,
            icon: 'smart_toy'
          }))
        } else if (charBeforeCursor === '#') {
          items = (info.tools != null ? info.tools : []).map(tool => ({
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

  return (
    <div className='chat-input-wrapper'>
      {isThinking && <ThinkingStatus />}
      {interactionRequest != null && (
        <div
          className='interaction-panel'
          style={{
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '200px',
            overflowY: 'auto',
            marginBottom: '10px',
            gap: '8px',
            padding: '8px',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-color)'
          }}
        >
          <div className='interaction-question' style={{ fontWeight: 'bold' }}>
            {interactionRequest.payload.question}
          </div>
          {interactionRequest.payload.options?.map((option) => (
            <Button
              key={option.label}
              block
              style={{ height: 'auto', textAlign: 'left', display: 'block', padding: '8px 12px' }}
              onClick={() => onInteractionResponse?.(interactionRequest.id, option.label)}
            >
              <div style={{ fontWeight: 500 }}>{option.label}</div>
              {option.description && (
                <div style={{ fontSize: '12px', color: 'var(--sub-text-color)', marginTop: '4px' }}>
                  {option.description}
                </div>
              )}
            </Button>
          ))}
        </div>
      )}
      <div className='chat-input-container'>
        {connectionError && connectionError.trim() !== '' && (
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
        {modelUnavailable && (
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
          disabled={modelUnavailable}
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
            <Tooltip title='快捷指令'>
              <span>
                <div className='toolbar-btn' onClick={() => handleTriggerClick('/')}>
                  <span className='material-symbols-rounded'>terminal</span>
                </div>
              </span>
            </Tooltip>
            <Tooltip title='提及代理'>
              <span>
                <div className='toolbar-btn' onClick={() => handleTriggerClick('@')}>
                  <span className='material-symbols-rounded'>smart_toy</span>
                </div>
              </span>
            </Tooltip>
            <Tooltip title='注入上下文'>
              <span>
                <div className='toolbar-btn' onClick={() => handleTriggerClick('#')}>
                  <span className='material-symbols-rounded'>description</span>
                </div>
              </span>
            </Tooltip>
            <Tooltip title='上传图片'>
              <span>
                <div className='toolbar-btn' onClick={handleImageUpload}>
                  <span className='material-symbols-rounded'>image</span>
                </div>
              </span>
            </Tooltip>

            {sessionInfo != null && sessionInfo.type === 'init' && (
              <div className='session-info-toolbar'>
                <Cascader
                  open={showToolsList}
                  options={toolCascaderOptions}
                  expandTrigger='hover'
                  placement='topLeft'
                  allowClear={false}
                  popupClassName='sender-tools-cascader-popup'
                  onOpenChange={setShowToolsList}
                  onChange={() => setShowToolsList(false)}
                >
                  <div className={`info-item ${showToolsList ? 'active' : ''}`}>
                    <span className='info-item-leading'>
                      <span className='material-symbols-rounded'>build</span>
                    </span>
                    <span className='info-text'>{t('chat.toolsCount', { count: sessionInfo.tools.length })}</span>
                    <span className='material-symbols-rounded arrow-icon'>keyboard_arrow_up</span>
                  </div>
                </Cascader>
              </div>
            )}
          </div>

          <div className='toolbar-right'>
            {adapterOptions && adapterOptions.length > 1 && (
              <Select
                className='adapter-select'
                classNames={{ popup: { root: 'adapter-select-popup' } }}
                value={selectedAdapter}
                options={adapterOptions}
                showSearch={false}
                allowClear={false}
                disabled={modelUnavailable || isThinking}
                onChange={(value) => onAdapterChange?.(value)}
                placeholder={t('chat.adapterSelectPlaceholder', { defaultValue: 'Adapter' })}
                optionLabelProp='label'
                popupMatchSelectWidth={false}
              />
            )}

            <Select
              className='model-select'
              classNames={{ popup: { root: 'model-select-popup' } }}
              value={selectedModel}
              options={modelOptions ?? []}
              showSearch
              allowClear={false}
              disabled={modelUnavailable || isThinking}
              onChange={(value) => onModelChange?.(value)}
              placeholder={modelUnavailable ? t('chat.modelUnavailable') : t('chat.modelSelectPlaceholder')}
              optionLabelProp='displayLabel'
              filterOption={(input, option) => {
                const searchText = String((option as ModelSelectOption | undefined)?.searchText ?? '')
                return searchText.toLowerCase().includes(input.toLowerCase())
              }}
              popupMatchSelectWidth={false}
            />

            <Select
              className='permission-mode-select'
              classNames={{ popup: { root: 'permission-mode-select-popup' } }}
              value={permissionMode}
              options={permissionModeOptions}
              showSearch={false}
              allowClear={false}
              disabled={modelUnavailable || isThinking}
              onChange={(value) => onPermissionModeChange(value)}
              placeholder='权限模式'
              optionLabelProp='label'
              popupMatchSelectWidth={false}
            />

            <div
              className={`chat-send-btn ${input.trim() !== '' && !modelUnavailable ? 'active' : ''} ${
                isThinking ? 'thinking' : ''
              } ${modelUnavailable ? 'disabled' : ''}`}
              onClick={modelUnavailable ? undefined : (isThinking ? onInterrupt : handleSend)}
            >
              <span className='material-symbols-rounded'>
                {isThinking ? 'stop_circle' : 'send'}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className='chat-input-hint'>
        {t('chat.hint')}
      </div>
    </div>
  )
}
