import type { WorkspaceTreeEntry } from '#~/api'

import type { ProjectFileTreeNode, ProjectFileTreeSelectableTypes } from './project-file-tree-types'

export const replaceProjectFileTreeNodeChildren = (
  nodes: ProjectFileTreeNode[],
  targetPath: string,
  children: ProjectFileTreeNode[]
): ProjectFileTreeNode[] =>
  nodes.map((node) => {
    if (node.path === targetPath) {
      return { ...node, children }
    }
    if (node.children == null) {
      return node
    }
    return {
      ...node,
      children: replaceProjectFileTreeNodeChildren(node.children, targetPath, children)
    }
  })

export const toProjectFileTreeNodes = (entries: WorkspaceTreeEntry[]): ProjectFileTreeNode[] =>
  entries.map(entry => ({ ...entry }))

export const getProjectFileTreeLinkKind = (node: ProjectFileTreeNode) =>
  node.linkKind ?? (node.isSymlink === true ? 'symlink' : undefined)

export const canExpandProjectFileTreeDirectory = (node: ProjectFileTreeNode) => {
  const linkKind = getProjectFileTreeLinkKind(node)
  return node.type === 'directory' &&
    (linkKind == null || (linkKind === 'symlink' && node.linkType === 'directory' && node.isExternal !== true))
}

const canAutoExpandDirectoryNode = (node: ProjectFileTreeNode) =>
  canExpandProjectFileTreeDirectory(node) && getProjectFileTreeLinkKind(node) == null

export const canOpenProjectFileTreeFile = (node: ProjectFileTreeNode) => {
  const linkKind = getProjectFileTreeLinkKind(node)
  return node.type === 'file' &&
    (linkKind == null || (linkKind === 'symlink' && node.linkType === 'file' && node.isExternal !== true))
}

export const canSelectProjectFileTreeNode = (
  node: ProjectFileTreeNode,
  selectableTypes: ProjectFileTreeSelectableTypes
) => selectableTypes === 'all' || node.type === 'file'

export const loadProjectFileTreeDirectoryRecursive = async (
  node: ProjectFileTreeNode,
  loadWorkspaceTree: (path?: string) => Promise<{ entries: WorkspaceTreeEntry[] }>
): Promise<ProjectFileTreeNode> => {
  if (!canAutoExpandDirectoryNode(node)) {
    return node
  }

  const children = node.children ?? toProjectFileTreeNodes((await loadWorkspaceTree(node.path)).entries)
  return {
    ...node,
    children: await Promise.all(children.map(child => loadProjectFileTreeDirectoryRecursive(child, loadWorkspaceTree)))
  }
}

export const collectProjectFileTreeDirectoryPaths = (nodes: ProjectFileTreeNode[]): string[] => {
  const paths: string[] = []
  for (const node of nodes) {
    if (!canAutoExpandDirectoryNode(node)) {
      continue
    }
    paths.push(node.path)
    if (node.children != null) {
      paths.push(...collectProjectFileTreeDirectoryPaths(node.children))
    }
  }
  return paths
}

export const getProjectFileTreeAncestorDirectoryPaths = (filePath?: string | null): string[] => {
  if (filePath == null || filePath.trim() === '') {
    return []
  }

  const parts = filePath.split('/').filter(part => part.length > 0)
  return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join('/'))
}

export const flattenVisibleProjectFileTreeNodes = (
  nodes: ProjectFileTreeNode[],
  expandedPaths: Set<string>
): ProjectFileTreeNode[] => {
  const visibleNodes: ProjectFileTreeNode[] = []

  for (const node of nodes) {
    visibleNodes.push(node)
    if (expandedPaths.has(node.path) && node.children != null) {
      visibleNodes.push(...flattenVisibleProjectFileTreeNodes(node.children, expandedPaths))
    }
  }

  return visibleNodes
}
