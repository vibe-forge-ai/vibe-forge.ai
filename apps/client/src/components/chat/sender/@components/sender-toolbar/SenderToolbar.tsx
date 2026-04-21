import './SenderToolbar.scss'

import type {
  SenderToolbarData,
  SenderToolbarHandlers,
  SenderToolbarRefs,
  SenderToolbarState
} from '../../@types/sender-toolbar-types'

import { EffortSelectControl } from '../effort-select/EffortSelectControl'
import { ModelSelectControl } from '../model-select/ModelSelectControl'
import { ReferenceActionsControl } from '../reference-actions/ReferenceActionsControl'
import { SenderSubmitAction } from '../sender-submit-action/SenderSubmitAction'

export function SenderToolbar({
  state,
  data,
  refs,
  handlers
}: {
  state: SenderToolbarState
  data: SenderToolbarData
  refs: SenderToolbarRefs
  handlers: SenderToolbarHandlers
}) {
  return (
    <div className='chat-input-toolbar'>
      {!state.hideReferenceActions && (
        <input
          ref={refs.fileInputRef}
          type='file'
          accept='image/*'
          multiple
          onChange={handlers.onImageFileChange}
          className='file-input-hidden'
        />
      )}

      <div className='toolbar-left'>
        {!state.hideReferenceActions && (
          <ReferenceActionsControl
            state={state}
            refs={refs}
            handlers={handlers}
          />
        )}

        {!state.isInlineEdit && (
          <ModelSelectControl
            state={state}
            data={data}
            refs={refs}
            handlers={handlers}
          />
        )}

        {!state.isInlineEdit && state.supportsEffort && (
          <EffortSelectControl
            state={state}
            data={data}
            refs={refs}
            handlers={handlers}
          />
        )}
      </div>

      {!state.hideSubmitAction && (
        <div className={`toolbar-right ${state.isInlineEdit ? 'toolbar-right--inline-edit' : ''}`.trim()}>
          <SenderSubmitAction
            isInlineEdit={state.isInlineEdit}
            submitLoading={state.submitLoading}
            submitLabel={data.submitLabel}
            hasComposerContent={state.hasComposerContent}
            modelUnavailable={state.modelUnavailable}
            sendBlocked={state.sendBlocked}
            sendBlockedTooltip={state.sendBlockedTooltip}
            showConfirmInteractionAction={state.showConfirmInteractionAction}
            confirmInteractionLabel={data.confirmInteractionLabel}
            isThinking={state.isThinking}
            resolvedSendShortcut={state.resolvedSendShortcut}
            queueSteerShortcut={data.composerControlShortcuts.queueSteer}
            queueNextShortcut={data.composerControlShortcuts.queueNext}
            isMac={state.isMac}
            onCancel={handlers.onCancel}
            onConfirmInteractionAction={handlers.onConfirmInteractionOption}
            onSend={handlers.onSend}
            onStop={handlers.onInterrupt}
          />
        </div>
      )}
    </div>
  )
}
