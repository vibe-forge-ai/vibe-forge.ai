import './Sender.scss'

import { useSenderController } from '#~/components/chat/sender/@hooks/use-sender-controller'

import { SenderBody } from './@components/sender-body/SenderBody'
import type { SenderProps } from './@types/sender-props'

export function Sender(props: SenderProps) {
  const controller = useSenderController(props)

  return (
    <div
      className={[
        'chat-input-wrapper',
        controller.hideSender ? 'chat-input-wrapper--permission' : '',
        controller.isInlineEdit ? 'chat-input-wrapper--inline-edit' : ''
      ].filter(Boolean).join(' ')}
    >
      {!controller.hideSender && (
        <SenderBody
          isInlineEdit={controller.isInlineEdit}
          isBusy={controller.isBusy}
          modelUnavailable={controller.modelUnavailable}
          pendingImages={controller.composer.pendingImages}
          pendingFiles={controller.composer.pendingFiles}
          onRemovePendingImage={(id) =>
            controller.composer.setPendingImages(prev => prev.filter(image => image.id !== id))}
          onRemovePendingFile={(path) =>
            controller.composer.setPendingFiles(prev => prev.filter(file => file.path !== path))}
          editorRef={controller.editorRef}
          sessionInfo={props.sessionInfo}
          placeholder={controller.placeholder}
          input={controller.composer.input}
          onInputChange={controller.onInputChange}
          onCursorChange={controller.onCursorChange}
          onKeyDown={controller.handleKeyDown}
          onPaste={controller.attachments.handlePaste}
          secondarySendShortcut={controller.secondarySendShortcut}
          onSecondarySendShortcut={controller.onSecondarySendShortcut}
          resolveCompletionMatch={controller.completion.resolveCompletionMatch}
          resolveTokenDecorations={controller.completion.resolveTokenDecorations}
          toolbarState={controller.toolbar.toolbarState}
          toolbarData={controller.toolbar.toolbarData}
          toolbarRefs={controller.toolbar.toolbarRefs}
          toolbarHandlers={controller.toolbar.toolbarHandlers}
          showContextPicker={controller.attachments.showContextPicker}
          onCancelContextPicker={controller.onCancelContextPicker}
          onConfirmContextPicker={controller.onConfirmContextPicker}
        />
      )}
    </div>
  )
}
