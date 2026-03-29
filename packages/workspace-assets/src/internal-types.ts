import type { WorkspaceAsset } from '@vibe-forge/types'

export interface WorkspaceDocumentPayload<TDefinition> {
  definition: TDefinition
  sourcePath: string
}

export interface WorkspaceOverlayPayload {
  sourcePath: string
  entryName: string
  targetSubpath: string
}

export type WorkspaceOpenCodeOverlayAsset =
  | (
    & Extract<WorkspaceAsset, { kind: 'nativePlugin' }>
    & { payload: WorkspaceOverlayPayload }
  )
  | Extract<WorkspaceAsset, { kind: 'agent' | 'command' | 'mode' }>

export type WorkspaceDocumentAsset<TDefinition> =
  & Extract<
    WorkspaceAsset,
    { kind: 'rule' | 'spec' | 'entity' | 'skill' }
  >
  & {
    payload: WorkspaceDocumentPayload<TDefinition & { path: string }>
  }

export const isOverlayPayload = (payload: unknown): payload is WorkspaceOverlayPayload => (
  payload != null &&
  typeof payload === 'object' &&
  typeof (payload as WorkspaceOverlayPayload).sourcePath === 'string' &&
  typeof (payload as WorkspaceOverlayPayload).entryName === 'string' &&
  typeof (payload as WorkspaceOverlayPayload).targetSubpath === 'string'
)

export const isOpenCodeOverlayAsset = (asset: WorkspaceAsset): asset is WorkspaceOpenCodeOverlayAsset => (
  (asset.kind === 'nativePlugin' || asset.kind === 'agent' || asset.kind === 'command' || asset.kind === 'mode') &&
  isOverlayPayload(asset.payload)
)
