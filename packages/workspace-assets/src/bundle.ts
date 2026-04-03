import type { Config, PluginConfig, WorkspaceAssetBundle } from '@vibe-forge/types'

import { collectWorkspaceAssets } from './bundle-internal'

export async function resolveWorkspaceAssetBundle(params: {
  cwd: string
  configs?: [Config?, Config?]
  plugins?: PluginConfig
  overlaySource?: string
  useDefaultVibeForgeMcpServer?: boolean
}): Promise<WorkspaceAssetBundle> {
  const collected = await collectWorkspaceAssets(params)

  return {
    cwd: params.cwd,
    pluginConfigs: collected.pluginConfigs,
    pluginInstances: collected.pluginInstances,
    assets: collected.assets,
    rules: collected.rules,
    specs: collected.specs,
    entities: collected.entities,
    skills: collected.skills,
    mcpServers: collected.mcpServers,
    hookPlugins: collected.hookPlugins,
    opencodeOverlayAssets: collected.opencodeOverlayAssets,
    defaultIncludeMcpServers: collected.defaultIncludeMcpServers,
    defaultExcludeMcpServers: collected.defaultExcludeMcpServers
  }
}
