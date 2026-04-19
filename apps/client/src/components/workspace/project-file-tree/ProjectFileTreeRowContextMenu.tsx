import { App, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import type { ReactElement } from 'react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { copyTextWithFeedback } from '#~/utils/copy'

import type { ProjectFileTreeNode } from './project-file-tree-types'

const renderMenuIcon = (icon: string) =>
  <span className='material-symbols-rounded project-file-tree__menu-icon'>{icon}</span>

export function ProjectFileTreeRowContextMenu({
  canOpenFile,
  canReference,
  canToggleDirectory,
  children,
  isDirectory,
  isExpanded,
  node,
  referenceNodes,
  onOpenFile,
  onReferenceNodes,
  onToggleDirectory
}: {
  canOpenFile: boolean
  canReference: boolean
  canToggleDirectory: boolean
  children: ReactElement
  isDirectory: boolean
  isExpanded: boolean
  node: ProjectFileTreeNode
  referenceNodes: ProjectFileTreeNode[]
  onOpenFile?: (path: string) => void
  onReferenceNodes?: (nodes: ProjectFileTreeNode[]) => void
  onToggleDirectory: (node: ProjectFileTreeNode) => void
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
    {
      key: 'reference',
      label: t('chat.workspaceTreeReferenceToInput'),
      icon: renderMenuIcon('alternate_email'),
      disabled: !canReference || onReferenceNodes == null,
      onClick: () => onReferenceNodes?.(referenceNodes.length > 0 ? referenceNodes : [node])
    },
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
  ], [
    canOpenFile,
    canReference,
    canToggleDirectory,
    isDirectory,
    isExpanded,
    message,
    node,
    onOpenFile,
    onReferenceNodes,
    onToggleDirectory,
    referenceNodes,
    t
  ])

  return (
    <Dropdown
      menu={{ items: menuItems }}
      overlayClassName='project-file-tree-context-dropdown'
      trigger={['contextMenu']}
    >
      {children}
    </Dropdown>
  )
}
