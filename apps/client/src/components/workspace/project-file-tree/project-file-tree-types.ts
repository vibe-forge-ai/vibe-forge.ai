import type { WorkspaceTreeEntry } from '#~/api'

export type ProjectFileTreeCommandAction = 'expand' | 'collapse' | 'locate'

export interface ProjectFileTreeCommand {
  action: ProjectFileTreeCommandAction
  id: number
  path?: string
}

export interface ProjectFileTreeNode extends WorkspaceTreeEntry {
  children?: ProjectFileTreeNode[]
}

export interface ProjectFileTreeSelection {
  nodes: ProjectFileTreeNode[]
  paths: string[]
}

export interface ProjectFileTreeSelectionAdjacency {
  hasSelectedAfter: boolean
  hasSelectedBefore: boolean
}

export type ProjectFileTreeSelectionMode = 'multiple' | 'none'

export type ProjectFileTreeSelectableTypes = 'all' | 'files'
