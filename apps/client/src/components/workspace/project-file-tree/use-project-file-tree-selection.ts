import type { MouseEvent } from 'react'
import { useCallback, useMemo, useRef, useState } from 'react'

import { canSelectProjectFileTreeNode } from './project-file-tree-helpers'
import type {
  ProjectFileTreeNode,
  ProjectFileTreeSelectableTypes,
  ProjectFileTreeSelection,
  ProjectFileTreeSelectionMode
} from './project-file-tree-types'

const uniqueNodes = (nodes: ProjectFileTreeNode[]) => {
  const seen = new Set<string>()
  const result: ProjectFileTreeNode[] = []
  for (const node of nodes) {
    if (seen.has(node.path)) {
      continue
    }
    seen.add(node.path)
    result.push(node)
  }
  return result
}

const getNodesByPaths = (paths: string[], visibleNodes: ProjectFileTreeNode[]) => {
  const nodeByPath = new Map(visibleNodes.map(node => [node.path, node]))
  return paths
    .map(path => nodeByPath.get(path))
    .filter((node): node is ProjectFileTreeNode => node != null)
}

export const useProjectFileTreeSelection = ({
  activePath,
  onSelectionChange,
  selectableTypes,
  selectedPaths,
  selectionMode,
  visibleNodes
}: {
  activePath?: string | null
  onSelectionChange?: (selection: ProjectFileTreeSelection) => void
  selectableTypes: ProjectFileTreeSelectableTypes
  selectedPaths?: string[]
  selectionMode: ProjectFileTreeSelectionMode
  visibleNodes: ProjectFileTreeNode[]
}) => {
  const [internalSelectedPaths, setInternalSelectedPaths] = useState<string[]>([])
  const selectionAnchorPathRef = useRef<string | null>(null)
  const resolvedSelectedPaths = selectedPaths ?? internalSelectedPaths
  const selectedNodes = useMemo(
    () => getNodesByPaths(resolvedSelectedPaths, visibleNodes),
    [resolvedSelectedPaths, visibleNodes]
  )
  const selectedPathSet = useMemo(() => {
    const paths = new Set(resolvedSelectedPaths)
    if (activePath != null && activePath !== '') {
      paths.add(activePath)
    }
    return paths
  }, [activePath, resolvedSelectedPaths])

  const emitSelectionChange = useCallback((
    nextNodes: ProjectFileTreeNode[]
  ) => {
    const normalizedNodes = uniqueNodes(nextNodes.filter(node => canSelectProjectFileTreeNode(node, selectableTypes)))
    const nextPaths = normalizedNodes.map(node => node.path)
    if (selectedPaths == null) {
      setInternalSelectedPaths(nextPaths)
    }
    onSelectionChange?.({ nodes: normalizedNodes, paths: nextPaths })
  }, [onSelectionChange, selectableTypes, selectedPaths])

  const handleContextSelect = useCallback((node: ProjectFileTreeNode) => {
    if (selectionMode === 'none' || selectedPathSet.has(node.path)) {
      return
    }
    selectionAnchorPathRef.current = node.path
    emitSelectionChange([node])
  }, [emitSelectionChange, selectedPathSet, selectionMode])

  const handleSelectNode = useCallback((node: ProjectFileTreeNode, event: MouseEvent<HTMLButtonElement>) => {
    if (selectionMode === 'none' || !canSelectProjectFileTreeNode(node, selectableTypes)) {
      return false
    }

    const isRangeSelection = event.shiftKey
    const isToggleSelection = event.metaKey || event.ctrlKey
    if (!isRangeSelection && !isToggleSelection) {
      selectionAnchorPathRef.current = node.path
      emitSelectionChange([node])
      return false
    }

    event.preventDefault()
    event.stopPropagation()

    const selectableVisibleNodes = visibleNodes.filter(item => canSelectProjectFileTreeNode(item, selectableTypes))
    if (selectableVisibleNodes.length === 0) {
      return true
    }

    if (isRangeSelection) {
      const anchorPath = selectionAnchorPathRef.current ?? resolvedSelectedPaths.at(-1) ?? node.path
      const anchorIndex = selectableVisibleNodes.findIndex(item => item.path === anchorPath)
      const targetIndex = selectableVisibleNodes.findIndex(item => item.path === node.path)
      if (targetIndex < 0) {
        return true
      }
      if (anchorIndex < 0) {
        emitSelectionChange([node])
        selectionAnchorPathRef.current = node.path
        return true
      }

      const start = Math.min(anchorIndex, targetIndex)
      const end = Math.max(anchorIndex, targetIndex)
      emitSelectionChange(selectableVisibleNodes.slice(start, end + 1))
      return true
    }

    selectionAnchorPathRef.current = node.path
    if (selectedPathSet.has(node.path)) {
      emitSelectionChange(selectedNodes.filter(item => item.path !== node.path))
    } else {
      emitSelectionChange([...selectedNodes, node])
    }
    return true
  }, [
    emitSelectionChange,
    resolvedSelectedPaths,
    selectableTypes,
    selectedNodes,
    selectedPathSet,
    selectionMode,
    visibleNodes
  ])

  return {
    handleContextSelect,
    handleSelectNode,
    selectedNodes,
    selectedPathSet
  }
}
