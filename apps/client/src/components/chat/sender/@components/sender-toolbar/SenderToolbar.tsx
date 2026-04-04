import './SenderToolbar.scss'

import type { SenderToolbarData, SenderToolbarHandlers, SenderToolbarRefs, SenderToolbarState } from '../../@types/sender-toolbar-types'

import { AdapterSelectControl } from '../adapter-select/AdapterSelectControl'
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
      <input
        ref={refs.fileInputRef}
        type='file'
        accept='image/*'
        multiple
        onChange={handlers.onImageFileChange}
        className='file-input-hidden'
      />

      <div className='toolbar-left'>
        <ReferenceActionsControl
          state={state}
          data={data}
          refs={refs}
          handlers={handlers}
        />

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

      <div className={`toolbar-right ${state.isInlineEdit ? 'toolbar-right--inline-edit' : ''}`.trim()}>
        {!state.isInlineEdit && (
          <AdapterSelectControl state={state} data={data} handlers={handlers} />
        )}

        <SenderSubmitAction
          isInlineEdit={state.isInlineEdit}
          submitLoading={state.submitLoading}
          submitLabel={data.submitLabel}
          hasComposerContent={state.hasComposerContent}
          hasSendText={state.hasSendText}
          modelUnavailable={state.modelUnavailable}
          isThinking={state.isThinking}
          resolvedSendShortcut={state.resolvedSendShortcut}
          isMac={state.isMac}
          onCancel={handlers.onCancel}
          onSend={handlers.onSend}
          onInterrupt={handlers.onInterrupt}
        />
      </div>
    </div>
  )
}
