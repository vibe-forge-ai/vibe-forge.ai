import { App, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import type { ReactElement } from 'react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { copyTextWithFeedback } from '#~/utils/copy'

import type { WorkspaceDrawerTreeNode } from './workspace-drawer-tree-types'

const renderMenuIcon = (icon: string) =>
  <span className='material-symbols-rounded chat-workspace-drawer__menu-icon'>{icon}</span>

export function WorkspaceDrawerTreeRowContextMenu({
  canOpenFile,
  canToggleDirectory,
  children,
  isDirectory,
  isExpanded,
  node,
  onOpenFile,
  onToggleDirectory
}: {
  canOpenFile: boolean
  canToggleDirectory: boolean
  children: ReactElement
  isDirectory: boolean
  isExpanded: boolean
  node: WorkspaceDrawerTreeNode
  onOpenFile?: (path: string) => void
  onToggleDirectory: (node: WorkspaceDrawerTreeNode) => void
}) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const menuItems = useMemo<MenuProps['items']>(() => [
    ...(isDirectory
      ? [
        {
          key: 'toggle',
          label: t(isExpanded ? 'chat.workspaceDrawerCollapseAll' : 'chat.workspaceDrawerExpandAll'),
          icon: renderMenuIcon(isExpanded ? 'folder_open' : 'folder'),
          disabled: !canToggleDirectory,
          onClick: () => onToggleDirectory(node)
        }
      ]
      : [
        {
          key: 'open',
          label: t('chat.workspaceFileOpen'),
          icon: renderMenuIcon('open_in_new'),
          disabled: !canOpenFile,
          onClick: () => onOpenFile?.(node.path)
        }
      ]),
    { type: 'divider' as const },
    {
      key: 'copy-path',
      label: t('chat.workspaceFileCopyPath'),
      icon: renderMenuIcon('content_copy'),
      onClick: () => {
        void copyTextWithFeedback({
          failureMessage: t('common.copyFailed'),
          messageApi: message,
          successMessage: t('chat.workspaceFilePathCopied'),
          text: node.path
        })
      }
    }
  ], [canOpenFile, canToggleDirectory, isDirectory, isExpanded, message, node, onOpenFile, onToggleDirectory, t])

  return (
    <Dropdown
      menu={{ items: menuItems }}
      overlayClassName='chat-workspace-drawer-context-dropdown'
      trigger={['contextMenu']}
    >
      {children}
    </Dropdown>
  )
}
