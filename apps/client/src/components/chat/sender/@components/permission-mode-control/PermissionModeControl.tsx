import './PermissionModeControl.scss'

import { Popover } from 'antd'
import { useTranslation } from 'react-i18next'

import { ShortcutTooltip } from '#~/components/ShortcutTooltip'

import type {
  SenderToolbarData,
  SenderToolbarHandlers,
  SenderToolbarRefs,
  SenderToolbarState
} from '../../@types/sender-toolbar-types'
import { permissionModeIconMap } from '../../@utils/sender-constants'

export function PermissionModeControl({
  state,
  data,
  refs,
  handlers
}: {
  state: Pick<
    SenderToolbarState,
    'showPermissionActions' | 'permissionMode' | 'canOpenReferenceActions' | 'isMac'
  >
  data: Pick<SenderToolbarData, 'permissionModeOptions' | 'composerControlShortcuts'>
  refs: Pick<SenderToolbarRefs, 'permissionMenuNavigation'>
  handlers: Pick<
    SenderToolbarHandlers,
    | 'onPermissionOpenChange'
    | 'onPermissionMenuKeyDown'
    | 'onSelectPermissionMode'
  >
}) {
  const { t } = useTranslation()
  const { showPermissionActions, permissionMode, canOpenReferenceActions, isMac } = state
  const { permissionModeOptions, composerControlShortcuts } = data
  const { permissionMenuNavigation } = refs
  const { onPermissionOpenChange, onPermissionMenuKeyDown, onSelectPermissionMode } = handlers
  const selectedPermissionOption = permissionModeOptions.find(option => option.value === permissionMode)

  const focusSelectedPermission = () => {
    permissionMenuNavigation.setActiveKey(permissionMode)
    window.requestAnimationFrame(() => {
      permissionMenuNavigation.focusKey(permissionMenuNavigation.activeKey ?? permissionMode)
    })
  }

  return (
    <Popover
      content={
        <div className='sender-permission-menu' role='menu' aria-label={t('chat.referencePermission')}>
          {permissionModeOptions.map(option => (
            <button
              key={option.value}
              ref={permissionMenuNavigation.registerItem(option.value)}
              type='button'
              role='menuitemradio'
              aria-checked={permissionMode === option.value}
              className={[
                'sender-permission-menu__item',
                `sender-permission-menu__item--${option.value}`,
                permissionMode === option.value ? 'is-selected' : ''
              ].filter(Boolean).join(' ')}
              onMouseEnter={() => permissionMenuNavigation.setActiveKey(option.value)}
              onFocus={() => permissionMenuNavigation.setActiveKey(option.value)}
              onKeyDown={(event) => onPermissionMenuKeyDown(event, option.value)}
              onClick={() => {
                onSelectPermissionMode(option.value)
              }}
            >
              <span className='sender-permission-menu__option'>
                <span
                  className={[
                    'material-symbols-rounded',
                    'sender-permission-menu__icon',
                    `sender-permission-menu__icon--${option.value}`
                  ].join(' ')}
                >
                  {permissionModeIconMap[option.value]}
                </span>
                <span className='sender-permission-menu__text'>{option.label}</span>
                {permissionMode === option.value && (
                  <span className='material-symbols-rounded sender-permission-menu__check'>check</span>
                )}
              </span>
            </button>
          ))}
        </div>
      }
      open={showPermissionActions}
      onOpenChange={(nextOpen) => {
        onPermissionOpenChange(nextOpen)
        if (nextOpen) {
          focusSelectedPermission()
        }
      }}
      placement='bottomRight'
      trigger='click'
      classNames={{ root: 'sender-permission-popover' }}
      destroyOnHidden
      arrow={false}
    >
      <ShortcutTooltip
        shortcut={composerControlShortcuts.switchPermissionMode}
        isMac={isMac}
        title={t('chat.referencePermission')}
        enabled={!showPermissionActions}
      >
        <button
          type='button'
          className={[
            'sender-permission-trigger',
            `sender-permission-trigger--${permissionMode}`,
            showPermissionActions ? 'is-open' : ''
          ].filter(Boolean).join(' ')}
          aria-label={t('chat.referencePermission')}
          aria-haspopup='menu'
          aria-expanded={showPermissionActions}
          onClick={canOpenReferenceActions
            ? undefined
            : (event) => {
              event.preventDefault()
              event.stopPropagation()
              onPermissionOpenChange(true)
            }}
          onKeyDown={(event) => {
            const isActivationKey = event.key === 'Enter' || event.key === ' '
            const isOpenKey = event.key === 'ArrowDown' || event.key === 'ArrowUp'

            if (isActivationKey || isOpenKey) {
              event.preventDefault()
              event.stopPropagation()
              if (!showPermissionActions) {
                onPermissionOpenChange(true)
              }
              focusSelectedPermission()
              return
            }

            if (event.key === 'Escape' && showPermissionActions) {
              event.preventDefault()
              event.stopPropagation()
              onPermissionOpenChange(false)
            }
          }}
        >
          <span
            className={[
              'material-symbols-rounded',
              'sender-permission-trigger__icon',
              `sender-permission-trigger__icon--${permissionMode}`
            ].join(' ')}
          >
            {permissionModeIconMap[permissionMode]}
          </span>
          <span className='sender-permission-trigger__copy'>
            <span
              className={[
                'sender-permission-trigger__value',
                `sender-permission-trigger__value--${permissionMode}`
              ].join(' ')}
            >
              {selectedPermissionOption?.label ?? t('chat.referencePermission')}
            </span>
          </span>
          <span className='material-symbols-rounded sender-permission-trigger__chevron'>expand_more</span>
        </button>
      </ShortcutTooltip>
    </Popover>
  )
}
