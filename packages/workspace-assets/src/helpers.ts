import type { WorkspaceAsset } from '@vibe-forge/types'
import { resolveRelativePath } from '@vibe-forge/utils'

export const resolvePluginIdFromPath = (cwd: string, path: string) => {
  const relativePath = resolveRelativePath(cwd, path)
  const match = relativePath.match(/^\.ai\/plugins\/([^/]+)\//)
  return match?.[1]
}

export const isPluginEnabled = (
  enabledPlugins: Record<string, boolean>,
  pluginId?: string
) => pluginId == null || enabledPlugins[pluginId] !== false

export const mergeRecord = <T>(left?: Record<string, T>, right?: Record<string, T>) => ({
  ...(left ?? {}),
  ...(right ?? {})
})

export const uniqueValues = (values: string[]) => Array.from(new Set(values.filter(Boolean)))

export const assetOriginPriority: Record<WorkspaceAsset['origin'], number> = {
  project: 0,
  plugin: 1,
  config: 2,
  fallback: 3
}

export const toAssetScope = (origin: WorkspaceAsset['origin']): WorkspaceAsset['scope'] => (
  origin === 'config'
    ? 'project'
    : origin === 'fallback'
      ? 'adapter'
      : 'workspace'
)
