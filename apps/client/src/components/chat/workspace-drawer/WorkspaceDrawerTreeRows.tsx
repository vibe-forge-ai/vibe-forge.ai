import { Spin } from 'antd'
import type { CSSProperties } from 'react'

import { WorkspaceDrawerTreeRow } from './WorkspaceDrawerTreeRow'
import {
  getWorkspaceFileIconMeta,
  getWorkspaceFolderIconMeta,
  getWorkspaceLinkedIconMeta
} from './workspace-drawer-icons'
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
            <WorkspaceDrawerTreeRow
              canOpenFile={canOpenFile}
              canToggleDirectory={canToggleDirectory}
              depth={depth}
              icon={icon}
              isDirectory={isDirectory}
              isExpanded={isExpanded}
              isLinkedNode={isLinkedNode}
              linkKind={linkKind}
              node={node}
              selectedFilePath={selectedFilePath}
              onOpenFile={onOpenFile}
              onToggleDirectory={onToggleDirectory}
            />
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
