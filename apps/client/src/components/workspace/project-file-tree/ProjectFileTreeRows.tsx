import { Spin } from 'antd'
import type { CSSProperties, MouseEvent } from 'react'

import { ProjectFileTreeRow } from './ProjectFileTreeRow'
import {
  canExpandProjectFileTreeDirectory,
  canOpenProjectFileTreeFile,
  canSelectProjectFileTreeNode,
  getProjectFileTreeLinkKind
} from './project-file-tree-helpers'
import { getProjectFileIconMeta, getProjectFolderIconMeta, getProjectLinkedIconMeta } from './project-file-tree-icons'
import type {
  ProjectFileTreeNode,
  ProjectFileTreeSelectableTypes,
  ProjectFileTreeSelectionAdjacency
} from './project-file-tree-types'

const getTreeRowStyle = (depth: number): CSSProperties => ({
  '--project-tree-depth': depth
} as CSSProperties)

export function ProjectFileTreeRows({
  depth,
  expandedPaths,
  loadingPaths,
  nodes,
  onContextSelect,
  onOpenFile,
  onReferenceNodes,
  onSelectNode,
  onToggleDirectory,
  referenceNodes,
  selectableTypes,
  selectedAdjacencyByPath,
  selectedPathSet,
  showContextMenu
}: {
  depth: number
  expandedPaths: Set<string>
  loadingPaths: Set<string>
  nodes: ProjectFileTreeNode[]
  onContextSelect: (node: ProjectFileTreeNode) => void
  onOpenFile?: (path: string) => void
  onReferenceNodes?: (nodes: ProjectFileTreeNode[]) => void
  onSelectNode: (node: ProjectFileTreeNode, event: MouseEvent<HTMLButtonElement>) => boolean
  onToggleDirectory: (node: ProjectFileTreeNode) => void
  referenceNodes: ProjectFileTreeNode[]
  selectableTypes: ProjectFileTreeSelectableTypes
  selectedAdjacencyByPath: Map<string, ProjectFileTreeSelectionAdjacency>
  selectedPathSet: Set<string>
  showContextMenu: boolean
}) {
  return (
    <>
      {nodes.map((node) => {
        const isDirectory = node.type === 'directory'
        const isExpanded = expandedPaths.has(node.path)
        const isLoading = loadingPaths.has(node.path)
        const linkKind = getProjectFileTreeLinkKind(node)
        const isLinkedNode = linkKind != null
        const icon = isLinkedNode
          ? getProjectLinkedIconMeta(node.name, node.linkType, isExpanded, linkKind)
          : isDirectory
          ? getProjectFolderIconMeta(node.name, isExpanded)
          : getProjectFileIconMeta(node.name)
        const canToggleDirectory = canExpandProjectFileTreeDirectory(node)
        const canOpenFile = canOpenProjectFileTreeFile(node)
        const canReference = canSelectProjectFileTreeNode(node, selectableTypes)
        const currentReferenceNodes = selectedPathSet.has(node.path) && referenceNodes.length > 0
          ? referenceNodes
          : [node]
        const selectedAdjacency = selectedAdjacencyByPath.get(node.path)

        return (
          <div key={node.path} className='project-file-tree__item'>
            <ProjectFileTreeRow
              canOpenFile={canOpenFile}
              canReference={canReference}
              canToggleDirectory={canToggleDirectory}
              depth={depth}
              icon={icon}
              hasSelectedAfter={selectedAdjacency?.hasSelectedAfter === true}
              hasSelectedBefore={selectedAdjacency?.hasSelectedBefore === true}
              isDirectory={isDirectory}
              isExpanded={isExpanded}
              isLinkedNode={isLinkedNode}
              isSelected={selectedPathSet.has(node.path)}
              linkKind={linkKind}
              node={node}
              referenceNodes={currentReferenceNodes}
              showContextMenu={showContextMenu}
              onContextSelect={onContextSelect}
              onOpenFile={onOpenFile}
              onReferenceNodes={onReferenceNodes}
              onSelectNode={onSelectNode}
              onToggleDirectory={onToggleDirectory}
            />
            {canToggleDirectory && (
              <div
                className={`project-file-tree__children ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}
                aria-hidden={!isExpanded}
              >
                <div className='project-file-tree__children-inner'>
                  {isLoading
                    ? (
                      <div
                        className='project-file-tree__row project-file-tree__row--loading'
                        style={getTreeRowStyle(depth + 1)}
                      >
                        <Spin size='small' />
                      </div>
                    )
                    : node.children != null && node.children.length > 0 && (
                      <ProjectFileTreeRows
                        depth={depth + 1}
                        expandedPaths={expandedPaths}
                        loadingPaths={loadingPaths}
                        nodes={node.children}
                        referenceNodes={referenceNodes}
                        selectableTypes={selectableTypes}
                        selectedAdjacencyByPath={selectedAdjacencyByPath}
                        selectedPathSet={selectedPathSet}
                        showContextMenu={showContextMenu}
                        onContextSelect={onContextSelect}
                        onOpenFile={onOpenFile}
                        onReferenceNodes={onReferenceNodes}
                        onSelectNode={onSelectNode}
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
