import { cwd as processCwd, env as processEnv } from 'node:process'

import type { Config } from '@vibe-forge/core'
import { loadConfig } from '@vibe-forge/core'
import { mergeAdapterConfigs } from '@vibe-forge/core/utils/model-selection'

export function getWorkspaceFolder() {
  return processEnv.__VF_PROJECT_WORKSPACE_FOLDER__ ?? processCwd()
}

export function buildConfigJsonVariables(
  workspaceFolder = getWorkspaceFolder()
): Record<string, string | null | undefined> {
  return {
    ...processEnv,
    WORKSPACE_FOLDER: workspaceFolder,
    __VF_PROJECT_WORKSPACE_FOLDER__: workspaceFolder
  }
}

const mergeRecord = <T>(left?: Record<string, T>, right?: Record<string, T>) => {
  if (left == null && right == null) return undefined
  return {
    ...(left ?? {}),
    ...(right ?? {})
  }
}

export function mergeConfigs(project?: Config, user?: Config): Config {
  return {
    ...project,
    ...user,
    adapters: mergeAdapterConfigs(
      project?.adapters as Record<string, unknown> | undefined,
      user?.adapters as Record<string, unknown> | undefined
    ) as Config['adapters'],
    models: mergeRecord(project?.models, user?.models),
    modelServices: mergeRecord(project?.modelServices, user?.modelServices),
    channels: mergeRecord(project?.channels, user?.channels),
    mcpServers: mergeRecord(project?.mcpServers, user?.mcpServers),
    enabledPlugins: mergeRecord(project?.enabledPlugins, user?.enabledPlugins),
    extraKnownMarketplaces: mergeRecord(project?.extraKnownMarketplaces, user?.extraKnownMarketplaces),
    plugins: user?.plugins ?? project?.plugins,
    shortcuts: mergeRecord(project?.shortcuts, user?.shortcuts),
    conversation: mergeRecord(project?.conversation, user?.conversation),
    notifications: mergeRecord(
      project?.notifications as Record<string, unknown> | undefined,
      user?.notifications as Record<string, unknown> | undefined
    ) as Config['notifications']
  }
}

export async function loadConfigSources() {
  const workspaceFolder = getWorkspaceFolder()
  const [projectConfig, userConfig] = await loadConfig({
    jsonVariables: buildConfigJsonVariables(workspaceFolder)
  })
  return {
    workspaceFolder,
    projectConfig,
    userConfig
  }
}

export async function loadMergedConfig() {
  const { workspaceFolder, projectConfig, userConfig } = await loadConfigSources()
  return {
    workspaceFolder,
    projectConfig,
    userConfig,
    mergedConfig: mergeConfigs(projectConfig, userConfig)
  }
}
