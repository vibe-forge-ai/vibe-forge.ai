import './ProjectFileTree.scss'

import { Empty, Spin } from 'antd'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { ProjectFileTreeRows } from './ProjectFileTreeRows'
import { flattenVisibleProjectFileTreeNodes } from './project-file-tree-helpers'
import type {
  ProjectFileTreeCommand,
  ProjectFileTreeNode,
  ProjectFileTreeSelectableTypes,
  ProjectFileTreeSelection,
  ProjectFileTreeSelectionAdjacency,
  ProjectFileTreeSelectionMode
} from './project-file-tree-types'
import { useProjectFileTreeData } from './use-project-file-tree-data'
import { useProjectFileTreeSelection } from './use-project-file-tree-selection'

export function ProjectFileTree({
  activePath,
  className,
  command,
  onOpenFile,
  onReferenceNodes,
  onSelectionChange,
  refreshKey = 0,
  selectableTypes = 'all',
  selectedPaths,
  selectionMode = 'none',
  sessionId,
  showContextMenu = false,
  showLoadingState = false
}: {
  activePath?: string | null
  className?: string
  command?: ProjectFileTreeCommand | null
  onOpenFile?: (path: string) => void
  onReferenceNodes?: (nodes: ProjectFileTreeNode[]) => void
  onSelectionChange?: (selection: ProjectFileTreeSelection) => void
  refreshKey?: number
  selectableTypes?: ProjectFileTreeSelectableTypes
  selectedPaths?: string[]
  selectionMode?: ProjectFileTreeSelectionMode
  sessionId?: string
  showContextMenu?: boolean
  showLoadingState?: boolean
}) {
  const { t } = useTranslation()
  const {
    expandedPaths,
    handleToggleDirectory,
    hasLoadedTree,
    hasTreeError,
    isRootLoading,
    loadingPaths,
    treeContainerRef,
    treeData
  } = useProjectFileTreeData({ command, refreshKey, sessionId })
  const visibleNodes = useMemo(
    () => flattenVisibleProjectFileTreeNodes(treeData, expandedPaths),
    [expandedPaths, treeData]
  )
  const {
    handleContextSelect,
    handleSelectNode,
    selectedNodes,
    selectedPathSet
  } = useProjectFileTreeSelection({
    activePath,
    onSelectionChange,
    selectableTypes,
    selectedPaths,
    selectionMode,
    visibleNodes
  })
  const selectedAdjacencyByPath = useMemo(() => {
    const adjacencyByPath = new Map<string, ProjectFileTreeSelectionAdjacency>()
    visibleNodes.forEach((node, index) => {
      if (!selectedPathSet.has(node.path)) {
        return
      }
      adjacencyByPath.set(node.path, {
        hasSelectedBefore: index > 0 && selectedPathSet.has(visibleNodes[index - 1]?.path ?? ''),
        hasSelectedAfter: index < visibleNodes.length - 1 && selectedPathSet.has(visibleNodes[index + 1]?.path ?? '')
      })
    })
    return adjacencyByPath
  }, [selectedPathSet, visibleNodes])

  if (hasTreeError) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={t('chat.contextPickerLoadFailed')}
      />
    )
  }

  if (!hasLoadedTree && showLoadingState && isRootLoading) {
    return (
      <div className='project-file-tree__loading'>
        <Spin size='small' />
        <span>{t('chat.contextPickerLoading')}</span>
      </div>
    )
  }

  if (hasLoadedTree && treeData.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={t('chat.contextPickerEmpty')}
      />
    )
  }

  return (
    <div ref={treeContainerRef} className={`project-file-tree ${className ?? ''}`.trim()}>
      <ProjectFileTreeRows
        depth={0}
        expandedPaths={expandedPaths}
        loadingPaths={loadingPaths}
        nodes={treeData}
        referenceNodes={selectedNodes}
        selectableTypes={selectableTypes}
        selectedAdjacencyByPath={selectedAdjacencyByPath}
        selectedPathSet={selectedPathSet}
        showContextMenu={showContextMenu}
        onContextSelect={handleContextSelect}
        onOpenFile={onOpenFile}
        onReferenceNodes={onReferenceNodes}
        onSelectNode={handleSelectNode}
        onToggleDirectory={handleToggleDirectory}
      />
    </div>
  )
}
