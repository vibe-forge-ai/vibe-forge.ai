import { Popover } from 'antd'
import { useTranslation } from 'react-i18next'

import { useResponsiveLayout } from '#~/hooks/use-responsive-layout'

import type {
  SenderToolbarData,
  SenderToolbarHandlers,
  SenderToolbarRefs,
  SenderToolbarState
} from '../../@types/sender-toolbar-types'
import { permissionModeIconMap } from '../../@utils/sender-constants'

export function ReferencePermissionActionsPopover({
  state,
  data,
  refs,
  handlers
}: {
  state: Pick<SenderToolbarState, 'showReferenceActions' | 'showPermissionActions' | 'permissionMode'>
  data: Pick<SenderToolbarData, 'permissionModeOptions'>
  refs: Pick<SenderToolbarRefs, 'referenceMenuNavigation' | 'permissionMenuNavigation'>
  handlers: Pick<
    SenderToolbarHandlers,
    | 'onShowPermissionActionsChange'
    | 'onReferenceMenuKeyDown'
    | 'onPermissionMenuKeyDown'
    | 'onSelectPermissionMode'
  >
}) {
  const { t } = useTranslation()
  const { isTouchInteraction } = useResponsiveLayout()
  const { showReferenceActions, showPermissionActions, permissionMode } = state
  const { permissionModeOptions } = data
  const { referenceMenuNavigation, permissionMenuNavigation } = refs
  const {
    onShowPermissionActionsChange,
    onReferenceMenuKeyDown,
    onPermissionMenuKeyDown,
    onSelectPermissionMode
  } = handlers
  const selectedPermissionOption = permissionModeOptions.find(option => option.value === permissionMode)

  return (
    <Popover
      content={
        <div className='reference-actions-menu reference-actions-menu--submenu'>
          {permissionModeOptions.map(option => (
            <button
              key={option.value}
              ref={permissionMenuNavigation.registerItem(option.value)}
              type='button'
              className={`reference-actions-menu-item ${permissionMode === option.value ? 'is-selected' : ''}`.trim()}
              onMouseEnter={() => permissionMenuNavigation.setActiveKey(option.value)}
              onFocus={() => permissionMenuNavigation.setActiveKey(option.value)}
              onKeyDown={(event) => onPermissionMenuKeyDown(event, option.value)}
              onClick={() => {
                onSelectPermissionMode(option.value)
              }}
            >
              <span className='reference-action-option reference-action-option--permission'>
                <span className='material-symbols-rounded reference-action-option__icon'>
                  {permissionModeIconMap[option.value]}
                </span>
                <span className='reference-action-option__label'>{option.label}</span>
                {permissionMode === option.value && (
                  <span className='material-symbols-rounded reference-action-option__check'>check</span>
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
        onShowPermissionActionsChange(nextOpen)
      }}
      placement='rightTop'
      trigger={isTouchInteraction ? ['click'] : ['hover', 'click']}
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
        onKeyDown={(event) => onReferenceMenuKeyDown(event, 'permission')}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onShowPermissionActionsChange(!showPermissionActions)
        }}
      >
        <span className='reference-action-option'>
          <span className='material-symbols-rounded reference-action-option__icon'>lock</span>
          <span className='reference-action-option__label'>{t('chat.referencePermission')}</span>
          <span className='reference-action-option__value'>{selectedPermissionOption?.label}</span>
          <span className='material-symbols-rounded reference-action-option__chevron'>chevron_right</span>
        </span>
      </button>
    </Popover>
  )
}
