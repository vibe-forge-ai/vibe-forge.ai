import type { WorkspaceTreeEntry } from '#~/api'

export type WorkspaceTreeCommandAction = 'expand' | 'collapse'

export interface WorkspaceTreeCommand {
  action: WorkspaceTreeCommandAction
  id: number
}

export interface WorkspaceDrawerTreeNode extends WorkspaceTreeEntry {
  children?: WorkspaceDrawerTreeNode[]
}
