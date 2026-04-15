import { cwd as processCwd, env as processEnv } from 'node:process'

import {
  buildConfigJsonVariables as buildWorkspaceConfigJsonVariables,
  loadConfig,
  mergeConfigs
} from '@vibe-forge/config'
import type { Config } from '@vibe-forge/types'

export function getWorkspaceFolder() {
  return processEnv.__VF_PROJECT_WORKSPACE_FOLDER__ ?? processCwd()
}

export function buildConfigJsonVariables(
  workspaceFolder = getWorkspaceFolder()
): Record<string, string | null | undefined> {
  return buildWorkspaceConfigJsonVariables(workspaceFolder, processEnv)
}

export async function loadConfigState(workspaceFolder = getWorkspaceFolder()) {
  const [projectConfig, userConfig] = await loadConfig({
    cwd: workspaceFolder,
    jsonVariables: buildConfigJsonVariables(workspaceFolder)
  })
  const mergedConfig: Config = mergeConfigs(projectConfig, userConfig) ?? {}
  return {
    workspaceFolder,
    projectConfig,
    userConfig,
    mergedConfig
  }
}
