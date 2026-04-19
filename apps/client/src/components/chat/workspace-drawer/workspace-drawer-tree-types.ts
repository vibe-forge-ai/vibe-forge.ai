import type { WorkspaceTreeEntry } from '#~/api'

export type WorkspaceTreeCommandAction = 'expand' | 'collapse' | 'locate'

export interface WorkspaceTreeCommand {
  action: WorkspaceTreeCommandAction
  id: number
  path?: string
}

export interface WorkspaceDrawerTreeNode extends WorkspaceTreeEntry {
  children?: WorkspaceDrawerTreeNode[]
}
