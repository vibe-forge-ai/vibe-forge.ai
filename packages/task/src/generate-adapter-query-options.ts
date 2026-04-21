import process from 'node:process'

import { buildConfigJsonVariables, loadConfigState, mergeConfigs } from '@vibe-forge/config'
import type { AdapterQueryOptions, PluginConfig } from '@vibe-forge/types'
import { resolvePromptAssetSelection, resolveWorkspaceAssetBundle } from '@vibe-forge/workspace-assets'

import { resolveQuerySelection } from '#~/query-selection.js'
import { resolveWorkspaceTaskTarget } from '#~/workspace-target.js'

export async function generateAdapterQueryOptions(
  type: 'spec' | 'entity' | 'workspace' | undefined,
  name?: string,
  cwd: string = process.cwd(),
  input?: {
    skills?: AdapterQueryOptions['skills']
    adapter?: string
    model?: string
    plugins?: PluginConfig
    updateConfiguredSkills?: boolean
  }
) {
  const workspace = type === 'workspace'
    ? await resolveWorkspaceTaskTarget({ cwd, name })
    : undefined
  const effectiveCwd = workspace?.cwd ?? cwd
  const promptType = type === 'workspace' ? undefined : type
  const promptName = type === 'workspace' ? undefined : name

  const jsonVariables = buildConfigJsonVariables(effectiveCwd, process.env)
  const {
    projectConfig: config,
    userConfig,
    mergedConfig
  } = await loadConfigState({ cwd: effectiveCwd, jsonVariables })
  const mergedPlugins = mergeConfigs(
    {
      plugins: mergedConfig?.plugins
    },
    {
      plugins: input?.plugins
    }
  )?.plugins
  const bundle = await resolveWorkspaceAssetBundle({
    cwd: effectiveCwd,
    configs: [config, userConfig],
    plugins: mergedPlugins,
    syncConfiguredSkills: true,
    updateConfiguredSkills: input?.updateConfiguredSkills === true
  })
  const selection = resolveQuerySelection({
    mergedConfig,
    inputAdapter: input?.adapter,
    inputModel: input?.model
  })
  const [data, resolvedOptions] = await resolvePromptAssetSelection({
    bundle,
    type: promptType,
    name: promptName,
    adapter: selection.adapter,
    input
  })
  return [
    data,
    {
      ...resolvedOptions,
      workspace
    } as Partial<AdapterQueryOptions> & {
      workspace?: Awaited<ReturnType<typeof resolveWorkspaceTaskTarget>>
    }
  ] as const
}
