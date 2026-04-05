import './Sender.scss'

import { ThinkingStatus } from '#~/components/chat/ThinkingStatus'
import { useSenderController } from '#~/components/chat/sender/@hooks/use-sender-controller'

import { SenderBody } from './@components/sender-body/SenderBody'
import { SenderInteractionPanel } from './@components/sender-interaction-panel/SenderInteractionPanel'
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
      {controller.isThinking && <ThinkingStatus />}
      {!controller.isInlineEdit && controller.interactionRequest != null && (
        <SenderInteractionPanel
          interactionRequest={controller.interactionRequest}
          permissionContext={controller.permissionContext}
          deniedTools={controller.deniedTools}
          reasons={controller.reasons}
          onInteractionResponse={controller.interactionResponse}
        />
      )}
      {!controller.hideSender && (
        <SenderBody
          isInlineEdit={controller.isInlineEdit}
          isBusy={controller.isBusy}
          modelUnavailable={controller.modelUnavailable}
          connectionError={controller.connectionError}
          onRetryConnection={controller.onRetryConnection}
          pendingImages={controller.composer.pendingImages}
          pendingFiles={controller.composer.pendingFiles}
          onRemovePendingImage={(id) =>
            controller.composer.setPendingImages(prev => prev.filter(image => image.id !== id))}
          onRemovePendingFile={(path) =>
            controller.composer.setPendingFiles(prev => prev.filter(file => file.path !== path))}
          showCompletion={controller.completion.showCompletion}
          completionItems={controller.completion.completionItems}
          selectedIndex={controller.completion.selectedIndex}
          onSelectCompletion={controller.completion.handleSelectCompletion}
          onCloseCompletion={() => controller.completion.setShowCompletion(false)}
          textareaRef={controller.textareaRef}
          placeholder={controller.placeholder}
          interactionRequest={controller.interactionRequest}
          input={controller.composer.input}
          onInputChange={controller.onInputChange}
          onKeyDown={controller.handleKeyDown}
          onPaste={controller.attachments.handlePaste}
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
