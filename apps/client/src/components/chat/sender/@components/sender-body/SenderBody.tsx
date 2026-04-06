import { Button } from 'antd'
import type { MutableRefObject } from 'react'
import { useTranslation } from 'react-i18next'

import type { SessionInfo } from '@vibe-forge/types'

import { ContextFilePicker } from '#~/components/workspace/ContextFilePicker'
import type { ChatErrorBannerState } from '#~/hooks/chat/interaction-state'

import type {
  SenderToolbarData,
  SenderToolbarHandlers,
  SenderToolbarRefs,
  SenderToolbarState
} from '../../@types/sender-toolbar-types'

import type { PendingContextFile } from '../../@types/sender-composer'
import type { SenderEditorHandle } from '../../@types/sender-editor'
import type { SenderCompletionMatch, SenderTokenDecoration } from '../../@utils/sender-completion'
import { SenderAttachments } from '../sender-attachments/SenderAttachments'
import { SenderMonacoEditor } from '../sender-monaco-editor/SenderMonacoEditor'
import { SenderToolbar } from '../sender-toolbar/SenderToolbar'

export function SenderBody({
  isInlineEdit,
  isBusy,
  modelUnavailable,
  errorBanner,
  onRetryConnection,
  pendingImages,
  pendingFiles,
  onRemovePendingImage,
  onRemovePendingFile,
  editorRef,
  sessionInfo,
  placeholder,
  input,
  onInputChange,
  onCursorChange,
  onKeyDown,
  onPaste,
  resolveCompletionMatch,
  resolveTokenDecorations,
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
  errorBanner?: ChatErrorBannerState | null
  onRetryConnection?: () => void
  pendingImages: Parameters<typeof SenderAttachments>[0]['pendingImages']
  pendingFiles: Parameters<typeof SenderAttachments>[0]['pendingFiles']
  onRemovePendingImage: (id: string) => void
  onRemovePendingFile: (path: string) => void
  editorRef: MutableRefObject<SenderEditorHandle | null>
  sessionInfo?: SessionInfo | null
  placeholder: string
  input: string
  onInputChange: (value: string, cursorOffset: number | null) => void
  onCursorChange: (cursorOffset: number | null) => void
  onKeyDown: (event: KeyboardEvent) => void
  onPaste: (event: ClipboardEvent) => void | Promise<void>
  resolveCompletionMatch: (value: string, cursorOffset: number | null, sessionInfo?: SessionInfo | null) => SenderCompletionMatch | null
  resolveTokenDecorations: (value: string) => SenderTokenDecoration[]
  toolbarState: SenderToolbarState
  toolbarData: SenderToolbarData
  toolbarRefs: SenderToolbarRefs
  toolbarHandlers: SenderToolbarHandlers
  showContextPicker: boolean
  onCancelContextPicker: () => void
  onConfirmContextPicker: (files: PendingContextFile[]) => void
}) {
  const { t } = useTranslation()
  const errorTitle = errorBanner?.kind === 'session'
    ? t('chat.sessionErrorTitle')
    : t('chat.connectionErrorTitle')

  return (
    <div className={`chat-input-container ${isInlineEdit ? 'chat-input-container--inline-edit' : ''}`.trim()}>
      {!isInlineEdit && errorBanner != null && errorBanner.message.trim() !== '' && (
        <div className='connection-error-banner'>
          <div className='connection-error-content'>
            <span className='material-symbols-rounded'>error</span>
            <div className='connection-error-copy'>
              <div className='connection-error-title'>{errorTitle}</div>
              <div className='connection-error-message'>{errorBanner.message}</div>
            </div>
          </div>
          {errorBanner.kind === 'connection' && onRetryConnection != null && (
            <Button size='small' onClick={onRetryConnection}>{t('chat.retryConnection')}</Button>
          )}
        </div>
      )}
      {!isInlineEdit && modelUnavailable && <div className='model-unavailable'>{t('chat.modelConfigRequired')}</div>}
      <SenderAttachments
        pendingImages={pendingImages}
        pendingFiles={pendingFiles}
        onRemovePendingImage={onRemovePendingImage}
        onRemovePendingFile={onRemovePendingFile}
      />
      <SenderMonacoEditor
        editorRef={editorRef}
        sessionInfo={sessionInfo}
        value={input}
        placeholder={placeholder || t('chat.inputPlaceholder')}
        disabled={(!isInlineEdit && modelUnavailable) || (isInlineEdit && isBusy)}
        sendShortcut={toolbarState.resolvedSendShortcut}
        onSendShortcut={toolbarHandlers.onSend}
        onInputChange={onInputChange}
        onCursorChange={onCursorChange}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        resolveCompletionMatch={resolveCompletionMatch}
        resolveTokenDecorations={resolveTokenDecorations}
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
