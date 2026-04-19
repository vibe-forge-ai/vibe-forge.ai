import { cwd as processCwd, env as processEnv } from 'node:process'

import {
  buildConfigJsonVariables as buildWorkspaceConfigJsonVariables,
  loadConfigState as loadWorkspaceConfigState
} from '@vibe-forge/config'

export function getWorkspaceFolder() {
  return processEnv.__VF_PROJECT_WORKSPACE_FOLDER__ ?? processCwd()
}

export function buildConfigJsonVariables(
  workspaceFolder = getWorkspaceFolder()
): Record<string, string | null | undefined> {
  return buildWorkspaceConfigJsonVariables(workspaceFolder, processEnv)
}

export async function loadConfigState(workspaceFolder = getWorkspaceFolder()) {
  const { projectConfig, userConfig, mergedConfig, projectSource, userSource } = await loadWorkspaceConfigState({
    cwd: workspaceFolder,
    jsonVariables: buildConfigJsonVariables(workspaceFolder)
  })
  return {
    workspaceFolder,
    projectConfig,
    userConfig,
    mergedConfig,
    projectSource,
    userSource
  }
}
