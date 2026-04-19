import { Spin, Tooltip } from 'antd'
import type { CSSProperties } from 'react'

import {
  getWorkspaceFileIconMeta,
  getWorkspaceFolderIconMeta,
  getWorkspaceLinkIndicatorIconMeta,
  getWorkspaceLinkedIconMeta
} from './workspace-drawer-icons'
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

export function WorkspaceDrawerTreeRows({
  depth,
  expandedPaths,
  loadingPaths,
  nodes,
  onOpenFile,
  selectedFilePath,
  onToggleDirectory
}: {
  depth: number
  expandedPaths: Set<string>
  loadingPaths: Set<string>
  nodes: WorkspaceDrawerTreeNode[]
  onOpenFile?: (path: string) => void
  selectedFilePath?: string | null
  onToggleDirectory: (node: WorkspaceDrawerTreeNode) => void
}) {
  return (
    <>
      {nodes.map((node) => {
        const isDirectory = node.type === 'directory'
        const isExpanded = expandedPaths.has(node.path)
        const isLoading = loadingPaths.has(node.path)
        const linkKind = node.linkKind ?? (node.isSymlink === true ? 'symlink' : undefined)
        const isLinkedNode = linkKind != null
        const icon = isLinkedNode
          ? getWorkspaceLinkedIconMeta(node.name, node.linkType, isExpanded, linkKind)
          : isDirectory
          ? getWorkspaceFolderIconMeta(node.name, isExpanded)
          : getWorkspaceFileIconMeta(node.name)
        const canToggleDirectory = isDirectory && (!isLinkedNode || (linkKind === 'symlink' &&
          node.linkType === 'directory' &&
          node.isExternal !== true))
        const canOpenFile = !isDirectory && (!isLinkedNode || (linkKind === 'symlink' &&
          node.linkType === 'file' &&
          node.isExternal !== true))

        return (
          <div key={node.path} className='chat-workspace-drawer__tree-item'>
            {isDirectory
              ? (
                <button
                  type='button'
                  className={`chat-workspace-drawer__tree-row is-directory ${isExpanded ? 'is-expanded' : ''} ${
                    isLinkedNode ? 'is-symlink' : ''
                  } ${canToggleDirectory ? '' : 'is-disabled'}`}
                  aria-disabled={!canToggleDirectory}
                  aria-label={getTreeNodeTitle(node)}
                  data-workspace-tree-path={node.path}
                  style={getTreeRowStyle(depth)}
                  tabIndex={canToggleDirectory ? undefined : -1}
                  title={isLinkedNode ? undefined : node.path}
                  onClick={() => {
                    if (canToggleDirectory) {
                      onToggleDirectory(node)
                    }
                  }}
                >
                  {renderTreeIcon(icon)}
                  <span className='chat-workspace-drawer__tree-name'>{node.name}</span>
                  {linkKind != null && renderLinkIndicator(node, linkKind)}
                </button>
              )
              : (
                <button
                  type='button'
                  className={`chat-workspace-drawer__tree-row is-file ${
                    selectedFilePath === node.path ? 'is-selected' : ''
                  } ${isLinkedNode ? 'is-symlink' : ''} ${canOpenFile ? '' : 'is-disabled'}`}
                  aria-disabled={!canOpenFile}
                  aria-label={getTreeNodeTitle(node)}
                  data-workspace-tree-path={node.path}
                  style={getTreeRowStyle(depth)}
                  tabIndex={canOpenFile ? undefined : -1}
                  title={isLinkedNode ? undefined : node.path}
                  onClick={() => {
                    if (canOpenFile) {
                      onOpenFile?.(node.path)
                    }
                  }}
                >
                  {renderTreeIcon(icon)}
                  <span className='chat-workspace-drawer__tree-name'>{node.name}</span>
                  {linkKind != null && renderLinkIndicator(node, linkKind)}
                </button>
              )}
            {canToggleDirectory && (
              <div
                className={`chat-workspace-drawer__tree-children ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}
                aria-hidden={!isExpanded}
              >
                <div className='chat-workspace-drawer__tree-children-inner'>
                  {isLoading
                    ? (
                      <div
                        className='chat-workspace-drawer__tree-row chat-workspace-drawer__tree-row--loading'
                        style={getTreeRowStyle(depth + 1)}
                      >
                        <Spin size='small' />
                      </div>
                    )
                    : node.children != null && node.children.length > 0 && (
                      <WorkspaceDrawerTreeRows
                        depth={depth + 1}
                        expandedPaths={expandedPaths}
                        loadingPaths={loadingPaths}
                        nodes={node.children}
                        selectedFilePath={selectedFilePath}
                        onOpenFile={onOpenFile}
                        onToggleDirectory={onToggleDirectory}
                      />
                    )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
