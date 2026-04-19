import { Button, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import { useTranslation } from 'react-i18next'

import type { TerminalShellKind } from '@vibe-forge/types'

import { TERMINAL_SHELL_KINDS } from '../@utils/terminal-panes'

export function TerminalPanelActions({
  isManagerToggleVisible,
  isManagerVisible,
  terminalCount,
  onAddTerminal,
  onToggleManager
}: {
  isManagerToggleVisible: boolean
  isManagerVisible: boolean
  terminalCount: number
  onAddTerminal: (shellKind?: TerminalShellKind) => void
  onToggleManager: () => void
}) {
  const { t } = useTranslation()
  const managerLabel = isManagerVisible ? t('chat.terminal.hideManager') : t('chat.terminal.showManager')
  const shellMenuItems: MenuProps['items'] = TERMINAL_SHELL_KINDS.map(shellKind => ({
    key: shellKind,
    label: t(`chat.terminal.shell.${shellKind}`)
  }))

  return (
    <div className='chat-terminal-view__header-actions' data-dock-panel-no-resize='true'>
      <div className='chat-terminal-view__create-actions'>
        <Button
          type='text'
          className='chat-terminal-view__create-btn chat-terminal-view__create-btn--add'
          icon={<span className='material-symbols-rounded'>add</span>}
          title={t('chat.terminal.addSession')}
          aria-label={t('chat.terminal.addSession')}
          onClick={() => onAddTerminal()}
        />
        <Dropdown
          menu={{
            items: shellMenuItems,
            onClick: ({ key }) => onAddTerminal(key as TerminalShellKind)
          }}
          placement='bottomRight'
          trigger={['click']}
        >
          <Button
            type='text'
            className='chat-terminal-view__create-btn chat-terminal-view__create-btn--menu'
            icon={<span className='material-symbols-rounded'>arrow_drop_down</span>}
            title={t('chat.terminal.selectShell')}
            aria-label={t('chat.terminal.selectShell')}
          />
        </Dropdown>
      </div>
      {isManagerToggleVisible && (
        <Button
          type='text'
          className='dock-panel__close-btn chat-terminal-view__manager-toggle-btn'
          icon={<span className='material-symbols-rounded'>view_sidebar</span>}
          title={managerLabel}
          aria-label={managerLabel}
          onClick={onToggleManager}
        >
          {!isManagerVisible && (
            <span className='chat-terminal-view__manager-toggle-badge' aria-hidden='true'>
              {terminalCount}
            </span>
          )}
        </Button>
      )}
    </div>
  )
}
