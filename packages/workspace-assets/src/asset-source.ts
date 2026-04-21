import type { DefinitionSource, WorkspaceAsset } from '@vibe-forge/types'

import { HOME_BRIDGE_RESOLVED_BY } from './home-bridge'

export const resolveWorkspaceAssetSource = (
  asset: Pick<WorkspaceAsset, 'origin' | 'resolvedBy'>
): DefinitionSource => (
  asset.resolvedBy === HOME_BRIDGE_RESOLVED_BY
    ? 'home'
    : asset.origin === 'plugin'
    ? 'plugin'
    : 'project'
)
