import { loadConfigState } from '@vibe-forge/config'

import type { RunOptions } from './types'

export const CLI_DEFAULT_PERMISSION_MODE: NonNullable<RunOptions['permissionMode']> = 'bypassPermissions'

export const resolveCliPermissionModeFromSources = (params: {
  cliPermissionMode?: RunOptions['permissionMode']
  cachedPermissionMode?: RunOptions['permissionMode']
  configuredPermissionMode?: RunOptions['permissionMode']
}) => (
  params.cliPermissionMode ??
  params.cachedPermissionMode ??
  params.configuredPermissionMode ??
  CLI_DEFAULT_PERMISSION_MODE
)

export const resolveCliPermissionModeForWorkspace = async (params: {
  cwd: string
  cliPermissionMode?: RunOptions['permissionMode']
  cachedPermissionMode?: RunOptions['permissionMode']
}) => {
  if (params.cliPermissionMode != null) {
    return params.cliPermissionMode
  }

  if (params.cachedPermissionMode != null) {
    return params.cachedPermissionMode
  }

  const { mergedConfig } = await loadConfigState({ cwd: params.cwd })
  return resolveCliPermissionModeFromSources({
    configuredPermissionMode: mergedConfig.permissions?.defaultMode
  })
}
