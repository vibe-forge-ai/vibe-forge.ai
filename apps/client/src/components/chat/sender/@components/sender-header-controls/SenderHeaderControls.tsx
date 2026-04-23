import { Tooltip } from 'antd'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { useSenderHeaderQueryState } from '#~/hooks/use-sender-header-query-state.js'

import type { SenderProps } from '../../@types/sender-props'
import type {
  SenderToolbarData,
  SenderToolbarHandlers,
  SenderToolbarRefs,
  SenderToolbarState
} from '../../@types/sender-toolbar-types'
import { permissionModeIconMap } from '../../@utils/sender-constants'
import { PermissionModeControl } from '../permission-mode-control/PermissionModeControl'
import { SenderSessionTargetBar } from '../session-target/SenderSessionTargetBar'

export function SenderHeaderControls({
  isInlineEdit,
  sessionTarget,
  toolbarState,
  toolbarData,
  toolbarRefs,
  toolbarHandlers
}: {
  isInlineEdit: boolean
  sessionTarget?: SenderProps['sessionTarget']
  toolbarState: SenderToolbarState
  toolbarData: SenderToolbarData
  toolbarRefs: SenderToolbarRefs
  toolbarHandlers: SenderToolbarHandlers
}) {
  const { t } = useTranslation()
  const { isHeaderCollapsed, setHeaderCollapsed } = useSenderHeaderQueryState()
  const showPermissionControl = !isInlineEdit && toolbarData.permissionModeOptions.length > 0
  const hasHeaderControls = !isInlineEdit && (sessionTarget != null || showPermissionControl)
  const headerStateClass = isHeaderCollapsed ? 'is-collapsed' : 'is-expanded'
  const selectedPermissionOption = toolbarData.permissionModeOptions.find(
    option => option.value === toolbarState.permissionMode
  )

  useEffect(() => {
    if (isHeaderCollapsed && toolbarState.showPermissionActions) {
      setHeaderCollapsed(false)
    }
  }, [isHeaderCollapsed, setHeaderCollapsed, toolbarState.showPermissionActions])

  if (!hasHeaderControls) {
    return null
  }

  const permissionControl = showPermissionControl
    ? (
      <PermissionModeControl
        state={{
          showPermissionActions: toolbarState.showPermissionActions,
          permissionMode: toolbarState.permissionMode,
          canOpenReferenceActions: toolbarState.canOpenReferenceActions,
          isMac: toolbarState.isMac
        }}
        data={{
          permissionModeOptions: toolbarData.permissionModeOptions,
          composerControlShortcuts: toolbarData.composerControlShortcuts
        }}
        refs={{ permissionMenuNavigation: toolbarRefs.permissionMenuNavigation }}
        handlers={{
          onPermissionOpenChange: toolbarHandlers.onPermissionOpenChange,
          onPermissionMenuKeyDown: toolbarHandlers.onPermissionMenuKeyDown,
          onSelectPermissionMode: toolbarHandlers.onSelectPermissionMode
        }}
      />
    )
    : null

  const headerActions = (
    <div className='chat-input-header-actions'>
      {permissionControl}
    </div>
  )

  const toggleHeader = () => {
    if (!isHeaderCollapsed) {
      toolbarHandlers.onPermissionOpenChange(false)
    }
    setHeaderCollapsed(!isHeaderCollapsed)
  }

  const headerToggle = (
    <div className={`chat-input-header-toggle-shell ${headerStateClass}`.trim()}>
      {showPermissionControl && isHeaderCollapsed && (
        <Tooltip
          title={selectedPermissionOption?.label ?? t('chat.referencePermission')}
          placement='top'
          destroyOnHidden
        >
          <div
            className={[
              'chat-input-header-toggle-mode-indicator',
              `chat-input-header-toggle-mode-indicator--${toolbarState.permissionMode}`
            ].join(' ')}
            aria-label={selectedPermissionOption?.label?.toString() ?? t('chat.referencePermission')}
          >
            <span
              className={[
                'material-symbols-rounded',
                'chat-input-header-toggle-mode-icon',
                `sender-permission-trigger__icon--${toolbarState.permissionMode}`
              ].join(' ')}
            >
              {permissionModeIconMap[toolbarState.permissionMode]}
            </span>
          </div>
        </Tooltip>
      )}
      <button
        type='button'
        className='chat-input-header-toggle-tab'
        aria-label={isHeaderCollapsed ? t('chat.expandHeaderControls') : t('chat.collapseHeaderControls')}
        aria-expanded={!isHeaderCollapsed}
        onClick={toggleHeader}
      >
        <span className='material-symbols-rounded'>
          {isHeaderCollapsed ? 'unfold_more' : 'unfold_less'}
        </span>
      </button>
    </div>
  )

  if (sessionTarget != null) {
    return (
      <>
        <SenderSessionTargetBar
          draft={sessionTarget.draft}
          locked={sessionTarget.locked}
          disabled={sessionTarget.disabled}
          onChange={sessionTarget.onChange}
          actions={headerActions}
          className={`chat-input-header-block ${headerStateClass}`.trim()}
          ariaHidden={isHeaderCollapsed}
        />
        {headerToggle}
      </>
    )
  }

  return (
    <>
      <div
        className={`chat-input-top-actions chat-input-header-block ${headerStateClass}`.trim()}
        aria-hidden={isHeaderCollapsed}
      >
        {headerActions}
      </div>
      {headerToggle}
    </>
  )
}
