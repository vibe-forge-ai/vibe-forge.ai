import './ReferenceActionsControl.scss'
import './ReferenceActionsOption.scss'

import { Popover } from 'antd'
import { useTranslation } from 'react-i18next'

import { ShortcutTooltip } from '#~/components/ShortcutTooltip'

import { ReferencePermissionActionsPopover } from './ReferencePermissionActionsPopover'
import type {
  SenderToolbarData,
  SenderToolbarHandlers,
  SenderToolbarRefs,
  SenderToolbarState
} from '../../@types/sender-toolbar-types'

export function ReferenceActionsControl({
  state,
  data,
  refs,
  handlers
}: {
  state: Pick<
    SenderToolbarState,
    | 'isInlineEdit'
    | 'canOpenReferenceActions'
    | 'showReferenceActions'
    | 'showPermissionActions'
    | 'permissionMode'
    | 'isMac'
  >
  data: Pick<SenderToolbarData, 'permissionModeOptions' | 'composerControlShortcuts'>
  refs: Pick<SenderToolbarRefs, 'referenceMenuNavigation' | 'permissionMenuNavigation'>
  handlers: Pick<
    SenderToolbarHandlers,
    | 'onReferenceOpenChange'
    | 'onShowPermissionActionsChange'
    | 'onOpenContextPicker'
    | 'onReferenceImageSelect'
    | 'onReferenceMenuKeyDown'
    | 'onPermissionMenuKeyDown'
    | 'onSelectPermissionMode'
    | 'onCloseReferenceActions'
  >
}) {
  const { t } = useTranslation()
  const {
    isInlineEdit,
    canOpenReferenceActions,
    showReferenceActions,
    showPermissionActions,
    permissionMode,
    isMac
  } = state
  const { permissionModeOptions, composerControlShortcuts } = data
  const { referenceMenuNavigation, permissionMenuNavigation } = refs
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
              onShowPermissionActionsChange(false)
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
                onShowPermissionActionsChange(false)
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
          {!isInlineEdit && permissionModeOptions.length > 0 && (
            <ReferencePermissionActionsPopover
              state={{ showReferenceActions, showPermissionActions, permissionMode }}
              data={{ permissionModeOptions }}
              refs={{ referenceMenuNavigation, permissionMenuNavigation }}
              handlers={{
                onShowPermissionActionsChange: handlers.onShowPermissionActionsChange,
                onReferenceMenuKeyDown,
                onPermissionMenuKeyDown: handlers.onPermissionMenuKeyDown,
                onSelectPermissionMode: handlers.onSelectPermissionMode
              }}
            />
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
      <ShortcutTooltip
        shortcut={composerControlShortcuts.switchPermissionMode}
        isMac={isMac}
        title={t('chat.referenceActionsShortcutTooltip')}
        enabled={!showReferenceActions}
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
      </ShortcutTooltip>
    </Popover>
  )
}
