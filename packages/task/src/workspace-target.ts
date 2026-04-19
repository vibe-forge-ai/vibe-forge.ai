import { resolve } from 'node:path'
import process from 'node:process'

import { buildConfigJsonVariables, loadConfig } from '@vibe-forge/config'
import type { WorkspaceDefinitionPayload } from '@vibe-forge/types'
import { findWorkspaceAsset, resolveConfiguredWorkspaceAssets } from '@vibe-forge/workspace-assets'

export interface ResolvedWorkspaceTaskTarget extends WorkspaceDefinitionPayload {}

export const resolveWorkspaceTaskTarget = async (params: {
  cwd?: string
  name?: string
}): Promise<ResolvedWorkspaceTaskTarget> => {
  const cwd = params.cwd ?? process.cwd()
  const name = params.name?.trim()
  if (name == null || name === '') {
    throw new Error('Workspace task requires a workspace name.')
  }

  const [config, userConfig] = await loadConfig({
    cwd,
    jsonVariables: buildConfigJsonVariables(cwd, process.env)
  })
  const workspaces = await resolveConfiguredWorkspaceAssets({
    cwd,
    configs: [config, userConfig]
  })
  const target = findWorkspaceAsset(workspaces, name)
  if (target == null) {
    const available = workspaces.map(workspace => workspace.displayName).join(', ')
    throw new Error(
      available === ''
        ? `Workspace "${name}" not found. Configure workspaces in .ai.config.json.`
        : `Workspace "${name}" not found. Available workspaces: ${available}.`
    )
  }

  return {
    ...target.payload,
    cwd: resolve(cwd, target.payload.path)
  }
}
