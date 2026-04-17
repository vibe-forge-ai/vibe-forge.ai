import process from 'node:process'

import { buildConfigJsonVariables, loadConfigState, mergeConfigs } from '@vibe-forge/config'
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
  const {
    projectConfig: config,
    userConfig,
    mergedConfig
  } = await loadConfigState({ cwd, jsonVariables })
  const mergedPlugins = mergeConfigs(
    {
      plugins: mergedConfig?.plugins
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
    mergedConfig,
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
