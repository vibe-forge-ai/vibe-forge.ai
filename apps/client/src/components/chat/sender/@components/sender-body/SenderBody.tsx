import { Button, Input } from 'antd'
import type { TextAreaRef } from 'antd/es/input/TextArea'
import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'

import type { AskUserQuestionParams } from '@vibe-forge/core'

import { ContextFilePicker } from '#~/components/workspace/ContextFilePicker'

import type { SenderToolbarData, SenderToolbarHandlers, SenderToolbarRefs, SenderToolbarState } from '../../@types/sender-toolbar-types'

import type { CompletionItem } from '../completion-menu/CompletionMenu'
import { CompletionMenu } from '../completion-menu/CompletionMenu'
import { SenderAttachments } from '../sender-attachments/SenderAttachments'
import { SenderToolbar } from '../sender-toolbar/SenderToolbar'
import type {
  PendingContextFile
} from '../../@types/sender-composer'
const { TextArea } = Input

export function SenderBody({
  isInlineEdit,
  isBusy,
  modelUnavailable,
  connectionError,
  onRetryConnection,
  pendingImages,
  pendingFiles,
  onRemovePendingImage,
  onRemovePendingFile,
  showCompletion,
  completionItems,
  selectedIndex,
  onSelectCompletion,
  onCloseCompletion,
  textareaRef,
  placeholder,
  interactionRequest,
  input,
  onInputChange,
  onKeyDown,
  onPaste,
  toolbarState,
  toolbarData,
  toolbarRefs,
  toolbarHandlers,
  showContextPicker,
  onCancelContextPicker,
  onConfirmContextPicker
}: {
  isInlineEdit: boolean
  isBusy: boolean
  modelUnavailable?: boolean
  connectionError?: string | null
  onRetryConnection?: () => void
  pendingImages: Parameters<typeof SenderAttachments>[0]['pendingImages']
  pendingFiles: Parameters<typeof SenderAttachments>[0]['pendingFiles']
  onRemovePendingImage: (id: string) => void
  onRemovePendingFile: (path: string) => void
  showCompletion: boolean
  completionItems: CompletionItem[]
  selectedIndex: number
  onSelectCompletion: (item: CompletionItem) => void
  onCloseCompletion: () => void
  textareaRef: RefObject<TextAreaRef>
  placeholder: string
  interactionRequest?: { id: string; payload: AskUserQuestionParams } | null
  input: string
  onInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void
  onKeyDown: (event: React.KeyboardEvent) => void
  onPaste: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void
  toolbarState: SenderToolbarState
  toolbarData: SenderToolbarData
  toolbarRefs: SenderToolbarRefs
  toolbarHandlers: SenderToolbarHandlers
  showContextPicker: boolean
  onCancelContextPicker: () => void
  onConfirmContextPicker: (files: PendingContextFile[]) => void
}) {
  const { t } = useTranslation()

  return (
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
          <Button size='small' onClick={onRetryConnection}>{t('chat.retryConnection')}</Button>
        </div>
      )}
      {!isInlineEdit && modelUnavailable && <div className='model-unavailable'>{t('chat.modelConfigRequired')}</div>}
      <SenderAttachments
        pendingImages={pendingImages}
        pendingFiles={pendingFiles}
        onRemovePendingImage={onRemovePendingImage}
        onRemovePendingFile={onRemovePendingFile}
      />
      {showCompletion && (
        <CompletionMenu
          items={completionItems}
          selectedIndex={selectedIndex}
          onSelect={onSelectCompletion}
          onClose={onCloseCompletion}
        />
      )}
      <TextArea
        ref={textareaRef}
        className='chat-input-textarea'
        placeholder={placeholder ?? interactionRequest?.payload.question ?? t('chat.inputPlaceholder')}
        value={input}
        onChange={onInputChange}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        autoSize={{ minRows: 1, maxRows: 10 }}
        variant='borderless'
        disabled={(!isInlineEdit && modelUnavailable) || isBusy}
      />
      <SenderToolbar state={toolbarState} data={toolbarData} refs={toolbarRefs} handlers={toolbarHandlers} />
      {!isInlineEdit && (
        <ContextFilePicker
          open={showContextPicker}
          selectedPaths={pendingFiles.map(file => file.path)}
          onCancel={onCancelContextPicker}
          onConfirm={onConfirmContextPicker}
        />
      )}
    </div>
  )
}
