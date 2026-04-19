import type { WorkspaceTreeEntry } from '#~/api'

import type { WorkspaceDrawerTreeNode } from './workspace-drawer-tree-types'

export const replaceNodeChildren = (
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

export const toTreeNodes = (entries: WorkspaceTreeEntry[]): WorkspaceDrawerTreeNode[] =>
  entries.map(entry => ({ ...entry }))

const getLinkKind = (node: WorkspaceDrawerTreeNode) =>
  node.linkKind ?? (node.isSymlink === true ? 'symlink' : undefined)

const canExpandDirectoryNode = (node: WorkspaceDrawerTreeNode) => {
  const linkKind = getLinkKind(node)
  return node.type === 'directory' &&
    (linkKind == null || (linkKind === 'symlink' && node.linkType === 'directory' && node.isExternal !== true))
}

const canAutoExpandDirectoryNode = (node: WorkspaceDrawerTreeNode) =>
  canExpandDirectoryNode(node) && getLinkKind(node) == null

export const loadWorkspaceDirectoryRecursive = async (
  node: WorkspaceDrawerTreeNode,
  loadWorkspaceTree: (path?: string) => Promise<{ entries: WorkspaceTreeEntry[] }>
): Promise<WorkspaceDrawerTreeNode> => {
  if (!canAutoExpandDirectoryNode(node)) {
    return node
  }

  const children = node.children ?? toTreeNodes((await loadWorkspaceTree(node.path)).entries)
  return {
    ...node,
    children: await Promise.all(children.map(child => loadWorkspaceDirectoryRecursive(child, loadWorkspaceTree)))
  }
}

export const collectDirectoryPaths = (nodes: WorkspaceDrawerTreeNode[]): string[] => {
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

export const getAncestorDirectoryPaths = (filePath?: string | null): string[] => {
  if (filePath == null || filePath.trim() === '') {
    return []
  }

  const parts = filePath.split('/').filter(part => part.length > 0)
  return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join('/'))
}
