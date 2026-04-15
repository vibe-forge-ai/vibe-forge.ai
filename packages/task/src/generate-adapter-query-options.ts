import process from 'node:process'

import { buildConfigJsonVariables, loadConfig, mergeConfigs } from '@vibe-forge/config'
import type { AdapterQueryOptions, PluginConfig } from '@vibe-forge/types'
import { resolvePromptAssetSelection, resolveWorkspaceAssetBundle } from '@vibe-forge/workspace-assets'

import { resolveQuerySelection } from '#~/query-selection.js'

export async function generateAdapterQueryOptions(
  type: 'spec' | 'entity' | undefined,
  name?: string,
  cwd: string = process.cwd(),
  input?: {
    skills?: AdapterQueryOptions['skills']
    adapter?: string
    model?: string
    plugins?: PluginConfig
  }
) {
  const jsonVariables = buildConfigJsonVariables(cwd, process.env)
  const [config, userConfig] = await loadConfig({ cwd, jsonVariables })
  const mergedPlugins = mergeConfigs(
    {
      plugins: mergeConfigs(
        { plugins: config?.plugins },
        { plugins: userConfig?.plugins }
      )?.plugins
    },
    {
      plugins: input?.plugins
    }
  )?.plugins
  const bundle = await resolveWorkspaceAssetBundle({
    cwd,
    configs: [config, userConfig],
    plugins: mergedPlugins
  })
  const selection = resolveQuerySelection({
    config,
    userConfig,
    inputAdapter: input?.adapter,
    inputModel: input?.model
  })
  const [data, resolvedOptions] = await resolvePromptAssetSelection({
    bundle,
    type,
    name,
    adapter: selection.adapter,
    input
  })
  return [
    data,
    resolvedOptions as Partial<AdapterQueryOptions>
  ] as const
}
