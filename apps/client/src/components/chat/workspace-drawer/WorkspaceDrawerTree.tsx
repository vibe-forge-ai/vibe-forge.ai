import { useCallback, useEffect, useRef, useState } from 'react'

import { listSessionWorkspaceTree, listWorkspaceTree } from '#~/api'
import type { WorkspaceTreeEntry } from '#~/api'

import { WorkspaceDrawerTreeRows } from './WorkspaceDrawerTreeRows'
import { WorkspaceDrawerTreeState } from './WorkspaceDrawerTreeState'
import type { WorkspaceDrawerTreeNode, WorkspaceTreeCommand } from './workspace-drawer-tree-types'

const replaceNodeChildren = (
  nodes: WorkspaceDrawerTreeNode[],
  targetPath: string,
  children: WorkspaceDrawerTreeNode[]
): WorkspaceDrawerTreeNode[] =>
  nodes.map((node) => {
    if (node.path === targetPath) {
      return { ...node, children }
    }
    if (node.children == null) {
      return node
    }
    return {
      ...node,
      children: replaceNodeChildren(node.children, targetPath, children)
    }
  })

const toTreeNodes = (entries: WorkspaceTreeEntry[]): WorkspaceDrawerTreeNode[] => entries.map(entry => ({ ...entry }))
const getLinkKind = (node: WorkspaceDrawerTreeNode) =>
  node.linkKind ?? (node.isSymlink === true ? 'symlink' : undefined)

const canExpandDirectoryNode = (node: WorkspaceDrawerTreeNode) => {
  const linkKind = getLinkKind(node)
  return node.type === 'directory' &&
    (linkKind == null || (linkKind === 'symlink' && node.linkType === 'directory' && node.isExternal !== true))
}
const canAutoExpandDirectoryNode = (node: WorkspaceDrawerTreeNode) =>
  canExpandDirectoryNode(node) && getLinkKind(node) == null
const collectDirectoryPaths = (nodes: WorkspaceDrawerTreeNode[]): string[] => {
  const paths: string[] = []
  for (const node of nodes) {
    if (!canAutoExpandDirectoryNode(node)) {
      continue
    }
    paths.push(node.path)
    if (node.children != null) {
      paths.push(...collectDirectoryPaths(node.children))
    }
  }
  return paths
}

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
  const [isTreeLoading, setIsTreeLoading] = useState(false)
  const [hasTreeError, setHasTreeError] = useState(false)
  const treeDataRef = useRef(treeData)
  const loadWorkspaceTree = useCallback(async (path?: string) => {
    if (sessionId != null && sessionId !== '') {
      return await listSessionWorkspaceTree(sessionId, path)
    }
    return await listWorkspaceTree(path)
  }, [sessionId])
  const loadRootTree = useCallback(async () => {
    setIsTreeLoading(true)
    setHasTreeError(false)
    setExpandedPaths(new Set())
    try {
      const result = await loadWorkspaceTree()
      setTreeData(toTreeNodes(result.entries))
    } catch {
      setTreeData([])
      setHasTreeError(true)
    } finally {
      setIsTreeLoading(false)
    }
  }, [loadWorkspaceTree])

  useEffect(() => {
    treeDataRef.current = treeData
  }, [treeData])
  useEffect(() => {
    void loadRootTree()
  }, [loadRootTree, refreshKey])

  const loadDirectoryRecursive = useCallback(
    async (node: WorkspaceDrawerTreeNode): Promise<WorkspaceDrawerTreeNode> => {
      if (!canAutoExpandDirectoryNode(node)) {
        return node
      }

      const children = node.children ?? toTreeNodes((await loadWorkspaceTree(node.path)).entries)
      return {
        ...node,
        children: await Promise.all(children.map(loadDirectoryRecursive))
      }
    },
    [loadWorkspaceTree]
  )
  useEffect(() => {
    if (command == null) {
      return
    }

    if (command.action === 'collapse') {
      setExpandedPaths(new Set())
      return
    }

    let isCancelled = false
    const runExpandAll = async () => {
      setIsTreeLoading(true)
      setHasTreeError(false)
      try {
        const nextTreeData = await Promise.all(treeDataRef.current.map(loadDirectoryRecursive))
        if (isCancelled) {
          return
        }
        setTreeData(nextTreeData)
        setExpandedPaths(new Set(collectDirectoryPaths(nextTreeData)))
      } catch {
        if (!isCancelled) {
          setHasTreeError(true)
        }
      } finally {
        if (!isCancelled) {
          setIsTreeLoading(false)
        }
      }
    }

    void runExpandAll()

    return () => {
      isCancelled = true
    }
  }, [command, loadDirectoryRecursive])
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

  if (isTreeLoading) {
    return <WorkspaceDrawerTreeState kind='loading' />
  }

  if (hasTreeError) {
    return <WorkspaceDrawerTreeState kind='error' />
  }

  if (treeData.length === 0) {
    return <WorkspaceDrawerTreeState kind='empty' />
  }

  return (
    <div className='chat-workspace-drawer__tree'>
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
