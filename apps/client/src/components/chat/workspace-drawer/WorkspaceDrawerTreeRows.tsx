import { Spin } from 'antd'
import type { CSSProperties } from 'react'

import { getWorkspaceFileIconMeta, getWorkspaceFolderIconMeta } from './workspace-drawer-icons'
import type { WorkspaceDrawerTreeNode } from './workspace-drawer-tree-types'

const getTreeRowStyle = (depth: number): CSSProperties => ({
  '--workspace-tree-depth': depth
} as CSSProperties)

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
        const icon = isDirectory
          ? getWorkspaceFolderIconMeta(node.name, isExpanded)
          : getWorkspaceFileIconMeta(node.name)

        return (
          <div key={node.path} className='chat-workspace-drawer__tree-item'>
            {isDirectory
              ? (
                <button
                  type='button'
                  className={`chat-workspace-drawer__tree-row is-directory ${isExpanded ? 'is-expanded' : ''}`}
                  style={getTreeRowStyle(depth)}
                  title={node.path}
                  onClick={() => onToggleDirectory(node)}
                >
                  <span className={`chat-workspace-drawer__tree-icon-wrap is-${icon.tone}`}>
                    <span className={`material-symbols-rounded chat-workspace-drawer__tree-icon is-${icon.tone}`}>
                      {icon.icon}
                    </span>
                    {icon.badgeIcon != null && (
                      <span
                        className={`material-symbols-rounded chat-workspace-drawer__tree-icon-badge is-${icon.tone}`}
                      >
                        {icon.badgeIcon}
                      </span>
                    )}
                  </span>
                  <span className='chat-workspace-drawer__tree-name'>{node.name}</span>
                </button>
              )
              : (
                <button
                  type='button'
                  className={`chat-workspace-drawer__tree-row is-file ${
                    selectedFilePath === node.path ? 'is-selected' : ''
                  }`}
                  style={getTreeRowStyle(depth)}
                  title={node.path}
                  onClick={() => onOpenFile?.(node.path)}
                >
                  <span className={`material-symbols-rounded chat-workspace-drawer__tree-icon is-${icon.tone}`}>
                    {icon.icon}
                  </span>
                  <span className='chat-workspace-drawer__tree-name'>{node.name}</span>
                </button>
              )}
            {isDirectory && (
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
