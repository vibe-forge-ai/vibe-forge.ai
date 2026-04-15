import type { WorkspaceAsset } from '@vibe-forge/types'

export const isOpenCodeOverlayAsset = (
  asset: WorkspaceAsset
): asset is Extract<WorkspaceAsset, { kind: 'nativePlugin' }> => asset.kind === 'nativePlugin'
