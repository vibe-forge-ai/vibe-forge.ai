import { Tooltip } from 'antd'
import type { CSSProperties } from 'react'

import { WorkspaceDrawerTreeRowContextMenu } from './WorkspaceDrawerTreeRowContextMenu'
import { getWorkspaceLinkIndicatorIconMeta } from './workspace-drawer-icons'
import type { WorkspaceDrawerIconMeta } from './workspace-drawer-icons'
import type { WorkspaceDrawerTreeNode } from './workspace-drawer-tree-types'

const getTreeRowStyle = (depth: number): CSSProperties => ({
  '--workspace-tree-depth': depth
} as CSSProperties)

const getTreeNodeTitle = (node: WorkspaceDrawerTreeNode) => {
  const linkKind = node.linkKind ?? (node.isSymlink === true ? 'symlink' : undefined)
  if (linkKind == null) {
    return node.path
  }

  const target = node.linkTarget == null ? '目标不存在' : node.linkTarget
  const state = node.linkType === 'missing'
    ? '（目标不存在）'
    : node.isExternal === true
    ? '（外部链接）'
    : ''
  return `${node.path} -> ${target}${state}`
}

const getLinkIndicatorTitle = (node: WorkspaceDrawerTreeNode, linkKind: 'gitdir' | 'symlink') => {
  const target = node.linkTarget == null || node.linkTarget === '' ? '目标不存在' : node.linkTarget
  if (node.linkType === 'missing') {
    return `链接目标不存在：${target}`
  }
  if (node.isExternal === true) {
    return `外部链接：${target}`
  }
  return `链接目标：${target}`
}

const renderTreeIcon = (icon: WorkspaceDrawerIconMeta) => (
  <span className={`chat-workspace-drawer__tree-icon-wrap is-${icon.tone}`}>
    <span className={`material-symbols-rounded chat-workspace-drawer__tree-icon is-${icon.tone}`}>
      {icon.icon}
    </span>
    {icon.badgeIcon != null && (
      <span className={`material-symbols-rounded chat-workspace-drawer__tree-icon-badge is-${icon.tone}`}>
        {icon.badgeIcon}
      </span>
    )}
  </span>
)

const renderLinkIndicator = (node: WorkspaceDrawerTreeNode, linkKind: 'gitdir' | 'symlink') => {
  const icon = getWorkspaceLinkIndicatorIconMeta(linkKind, node.linkType, node.isExternal)
  return (
    <Tooltip destroyOnHidden placement='left' title={getLinkIndicatorTitle(node, linkKind)}>
      <span className={`material-symbols-rounded chat-workspace-drawer__tree-link-indicator is-${icon.tone}`}>
        {icon.icon}
      </span>
    </Tooltip>
  )
}

export function WorkspaceDrawerTreeRow({
  canOpenFile,
  canToggleDirectory,
  depth,
  icon,
  isDirectory,
  isExpanded,
  isLinkedNode,
  linkKind,
  node,
  onOpenFile,
  onToggleDirectory,
  selectedFilePath
}: {
  canOpenFile: boolean
  canToggleDirectory: boolean
  depth: number
  icon: WorkspaceDrawerIconMeta
  isDirectory: boolean
  isExpanded: boolean
  isLinkedNode: boolean
  linkKind?: 'gitdir' | 'symlink'
  node: WorkspaceDrawerTreeNode
  onOpenFile?: (path: string) => void
  onToggleDirectory: (node: WorkspaceDrawerTreeNode) => void
  selectedFilePath?: string | null
}) {
  const isActionEnabled = isDirectory ? canToggleDirectory : canOpenFile
  const rowTypeClass = isDirectory ? 'is-directory' : 'is-file'
  const selectedClass = selectedFilePath === node.path ? 'is-selected' : ''

  return (
    <WorkspaceDrawerTreeRowContextMenu
      canOpenFile={canOpenFile}
      canToggleDirectory={canToggleDirectory}
      isDirectory={isDirectory}
      isExpanded={isExpanded}
      node={node}
      onOpenFile={onOpenFile}
      onToggleDirectory={onToggleDirectory}
    >
      <button
        type='button'
        className={`chat-workspace-drawer__tree-row ${rowTypeClass} ${isExpanded ? 'is-expanded' : ''} ${
          isLinkedNode ? 'is-symlink' : ''
        } ${selectedClass} ${isActionEnabled ? '' : 'is-disabled'}`}
        aria-disabled={!isActionEnabled}
        aria-label={getTreeNodeTitle(node)}
        data-workspace-tree-path={node.path}
        style={getTreeRowStyle(depth)}
        tabIndex={isActionEnabled ? undefined : -1}
        title={isLinkedNode ? undefined : node.path}
        onClick={() => {
          if (isDirectory && canToggleDirectory) {
            onToggleDirectory(node)
          } else if (!isDirectory && canOpenFile) {
            onOpenFile?.(node.path)
          }
        }}
      >
        {renderTreeIcon(icon)}
        <span className='chat-workspace-drawer__tree-name'>{node.name}</span>
        {linkKind != null && renderLinkIndicator(node, linkKind)}
      </button>
    </WorkspaceDrawerTreeRowContextMenu>
  )
}
