import type { WorkspaceAsset } from '@vibe-forge/types'

export const isOpenCodeOverlayAsset = (asset: WorkspaceAsset) => asset.kind === 'nativePlugin'
