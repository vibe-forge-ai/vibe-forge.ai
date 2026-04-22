import './ReferenceActionsControl.scss'
import './ReferenceActionsOption.scss'

import { Popover } from 'antd'
import { useTranslation } from 'react-i18next'

import type { SenderToolbarHandlers, SenderToolbarRefs, SenderToolbarState } from '../../@types/sender-toolbar-types'

export function ReferenceActionsControl({
  state,
  refs,
  handlers
}: {
  state: Pick<
    SenderToolbarState,
    | 'isInlineEdit'
    | 'canOpenReferenceActions'
    | 'showReferenceActions'
  >
  refs: Pick<SenderToolbarRefs, 'referenceMenuNavigation'>
  handlers: Pick<
    SenderToolbarHandlers,
    | 'onReferenceOpenChange'
    | 'onOpenContextPicker'
    | 'onReferenceImageSelect'
    | 'onReferenceMenuKeyDown'
    | 'onCloseReferenceActions'
  >
}) {
  const { t } = useTranslation()
  const { isInlineEdit, canOpenReferenceActions, showReferenceActions } = state
  const { referenceMenuNavigation } = refs
  const {
    onReferenceOpenChange,
    onOpenContextPicker,
    onReferenceImageSelect,
    onReferenceMenuKeyDown,
    onCloseReferenceActions
  } = handlers

  return (
    <Popover
      content={
        <div className='reference-actions-menu'>
          <button
            ref={referenceMenuNavigation.registerItem('image')}
            type='button'
            className='reference-actions-menu-item'
            onMouseEnter={() => {
              referenceMenuNavigation.setActiveKey('image')
            }}
            onFocus={() => referenceMenuNavigation.setActiveKey('image')}
            onKeyDown={(event) => onReferenceMenuKeyDown(event, 'image')}
            onClick={onReferenceImageSelect}
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
              }}
              onFocus={() => referenceMenuNavigation.setActiveKey('file')}
              onKeyDown={(event) => onReferenceMenuKeyDown(event, 'file')}
              onClick={() => {
                onCloseReferenceActions()
                onOpenContextPicker()
              }}
            >
              <span className='reference-action-option'>
                <span className='material-symbols-rounded reference-action-option__icon'>description</span>
                <span className='reference-action-option__label'>{t('chat.referenceFile')}</span>
              </span>
            </button>
          )}
        </div>
      }
      open={showReferenceActions}
      onOpenChange={onReferenceOpenChange}
      placement='topLeft'
      trigger='click'
      classNames={{ root: 'reference-actions-popover' }}
      destroyOnHidden
      arrow={false}
    >
      <div
        className={`toolbar-btn toolbar-btn--reference ${showReferenceActions ? 'active' : ''}`.trim()}
        tabIndex={-1}
        onClick={canOpenReferenceActions ? undefined : (event) => {
          event.preventDefault()
          void onReferenceOpenChange(true)
        }}
      >
        <span className='toolbar-btn__icon-shell'>
          <span className='material-symbols-rounded'>add</span>
        </span>
        <span className='toolbar-btn__text'>{t('chat.referenceActionsShort')}</span>
      </div>
    </Popover>
  )
}
