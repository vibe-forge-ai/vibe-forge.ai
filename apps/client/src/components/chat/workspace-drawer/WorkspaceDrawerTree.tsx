import { useCallback, useEffect, useRef, useState } from 'react'

import { listSessionWorkspaceTree, listWorkspaceTree } from '#~/api'

import { WorkspaceDrawerTreeRows } from './WorkspaceDrawerTreeRows'
import { WorkspaceDrawerTreeState } from './WorkspaceDrawerTreeState'
import {
  collectDirectoryPaths,
  getAncestorDirectoryPaths,
  loadWorkspaceDirectoryRecursive,
  replaceNodeChildren,
  toTreeNodes
} from './workspace-drawer-tree-helpers'
import type { WorkspaceDrawerTreeNode, WorkspaceTreeCommand } from './workspace-drawer-tree-types'

export function WorkspaceDrawerTree({
  command,
  onOpenFile,
  refreshKey,
  selectedFilePath,
  sessionId
}: {
  command: WorkspaceTreeCommand | null
  onOpenFile?: (path: string) => void
  refreshKey: number
  selectedFilePath?: string | null
  sessionId?: string
}) {
  const [treeData, setTreeData] = useState<WorkspaceDrawerTreeNode[]>([])
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set())
  const [hasLoadedTree, setHasLoadedTree] = useState(false)
  const [hasTreeError, setHasTreeError] = useState(false)
  const treeContainerRef = useRef<HTMLDivElement | null>(null)
  const treeDataRef = useRef(treeData)
  const treeOperationIdRef = useRef(0)
  const scrollTreePathIntoView = useCallback((path?: string) => {
    if (path == null || path === '') {
      return
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const rows = treeContainerRef.current?.querySelectorAll<HTMLElement>('[data-workspace-tree-path]') ?? []
        const target = Array.from(rows).find(row => row.dataset.workspaceTreePath === path)
        target?.scrollIntoView({ block: 'center', inline: 'nearest' })
      })
    })
  }, [])
  const loadWorkspaceTree = useCallback(async (path?: string) => {
    if (sessionId != null && sessionId !== '') {
      return await listSessionWorkspaceTree(sessionId, path)
    }
    return await listWorkspaceTree(path)
  }, [sessionId])
  const loadRootTree = useCallback(async () => {
    const operationId = treeOperationIdRef.current + 1
    treeOperationIdRef.current = operationId
    setHasTreeError(false)
    setExpandedPaths(new Set())
    try {
      const result = await loadWorkspaceTree()
      if (treeOperationIdRef.current !== operationId) {
        return
      }
      setTreeData(toTreeNodes(result.entries))
      setHasLoadedTree(true)
    } catch {
      if (treeOperationIdRef.current === operationId) {
        setTreeData([])
        setHasLoadedTree(true)
        setHasTreeError(true)
      }
    }
  }, [loadWorkspaceTree])

  useEffect(() => {
    treeDataRef.current = treeData
  }, [treeData])
  useEffect(() => {
    void loadRootTree()
  }, [loadRootTree, refreshKey])

  useEffect(() => {
    if (command == null) {
      return
    }

    if (command.action === 'collapse') {
      treeOperationIdRef.current += 1
      setExpandedPaths(new Set())
      return
    }

    let isCancelled = false
    const isCurrentOperation = (operationId: number) => !isCancelled && treeOperationIdRef.current === operationId
    const runLocateFile = async () => {
      if (command.path == null || command.path === '') {
        return
      }
      const ancestorPaths = getAncestorDirectoryPaths(command.path)
      const operationId = treeOperationIdRef.current + 1
      treeOperationIdRef.current = operationId
      setHasTreeError(false)
      try {
        let nextTreeData = treeDataRef.current
        if (nextTreeData.length === 0) {
          nextTreeData = toTreeNodes((await loadWorkspaceTree()).entries)
        }
        for (const path of ancestorPaths) {
          const result = await loadWorkspaceTree(path)
          nextTreeData = replaceNodeChildren(nextTreeData, path, toTreeNodes(result.entries))
        }
        if (!isCurrentOperation(operationId)) {
          return
        }
        setTreeData(nextTreeData)
        setHasLoadedTree(true)
        setExpandedPaths(prev => new Set([...prev, ...ancestorPaths]))
        scrollTreePathIntoView(command.path)
      } catch {
        if (isCurrentOperation(operationId)) {
          setHasLoadedTree(true)
          setHasTreeError(true)
        }
      }
    }
    const runExpandAll = async () => {
      const operationId = treeOperationIdRef.current + 1
      treeOperationIdRef.current = operationId
      setHasTreeError(false)
      try {
        const nextTreeData = await Promise.all(
          treeDataRef.current.map(node => loadWorkspaceDirectoryRecursive(node, loadWorkspaceTree))
        )
        if (!isCurrentOperation(operationId)) {
          return
        }
        setTreeData(nextTreeData)
        setHasLoadedTree(true)
        setExpandedPaths(new Set(collectDirectoryPaths(nextTreeData)))
      } catch {
        if (isCurrentOperation(operationId)) {
          setHasLoadedTree(true)
          setHasTreeError(true)
        }
      }
    }

    void (command.action === 'locate' ? runLocateFile() : runExpandAll())

    return () => {
      isCancelled = true
    }
  }, [command, loadWorkspaceTree, scrollTreePathIntoView])
  const handleToggleDirectory = async (node: WorkspaceDrawerTreeNode) => {
    if (expandedPaths.has(node.path)) {
      setExpandedPaths(prev => new Set(Array.from(prev).filter(path => path !== node.path)))
      return
    }

    setExpandedPaths(prev => new Set(prev).add(node.path))
    if (node.children != null) {
      return
    }

    setLoadingPaths(prev => new Set(prev).add(node.path))
    try {
      const result = await loadWorkspaceTree(node.path)
      setTreeData(prev => replaceNodeChildren(prev, node.path, toTreeNodes(result.entries)))
    } catch {
      setHasTreeError(true)
    } finally {
      setLoadingPaths(prev => new Set(Array.from(prev).filter(path => path !== node.path)))
    }
  }

  if (hasTreeError) {
    return <WorkspaceDrawerTreeState kind='error' />
  }

  if (hasLoadedTree && treeData.length === 0) {
    return <WorkspaceDrawerTreeState kind='empty' />
  }

  return (
    <div ref={treeContainerRef} className='chat-workspace-drawer__tree'>
      <WorkspaceDrawerTreeRows
        depth={0}
        expandedPaths={expandedPaths}
        loadingPaths={loadingPaths}
        nodes={treeData}
        selectedFilePath={selectedFilePath}
        onOpenFile={onOpenFile}
        onToggleDirectory={handleToggleDirectory}
      />
    </div>
  )
}
