import process from 'node:process'

import { buildConfigJsonVariables, loadConfig } from '@vibe-forge/config'
import type { AdapterQueryOptions } from '@vibe-forge/types'
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
  }
) {
  const jsonVariables = buildConfigJsonVariables(cwd, process.env)
  const [config, userConfig] = await loadConfig({ cwd, jsonVariables })
  const bundle = await resolveWorkspaceAssetBundle({
    cwd,
    configs: [config, userConfig]
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
