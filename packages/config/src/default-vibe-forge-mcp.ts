import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import process from 'node:process'

import type { Config } from '@vibe-forge/types'

import { mergeUniqueList } from './merge'

export const DEFAULT_VIBE_FORGE_MCP_SERVER_NAME = 'vibe-forge'
export const DEFAULT_VIBE_FORGE_MCP_PERMISSION_NAME = DEFAULT_VIBE_FORGE_MCP_SERVER_NAME

export const resolveUseDefaultVibeForgeMcpServer = (options: {
  runtimeValue?: boolean
  projectConfig?: Config
  userConfig?: Config
}) => (
  options.runtimeValue ??
    (options.userConfig?.noDefaultVibeForgeMcpServer != null
      ? !options.userConfig.noDefaultVibeForgeMcpServer
      : undefined) ??
    (options.projectConfig?.noDefaultVibeForgeMcpServer != null
      ? !options.projectConfig.noDefaultVibeForgeMcpServer
      : undefined) ??
    true
)

export const resolveDefaultVibeForgeMcpServerConfig = () => {
  try {
    const packageResolver = typeof require === 'function'
      ? require
      : createRequire(resolve(process.cwd(), '__vf_config_mcp_resolver__.js'))
    const workspacePackageJsonPath = resolve(process.cwd(), 'packages/mcp/package.json')
    const packageJsonPath = existsSync(workspacePackageJsonPath)
      ? workspacePackageJsonPath
      : resolvePublishedMcpPackageJsonPath(packageResolver)
    const packageDir = dirname(packageJsonPath)
    return {
      command: process.execPath,
      args: [resolve(packageDir, 'cli.js')]
    } satisfies NonNullable<Config['mcpServers']>[string]
  } catch {
    return undefined
  }
}

const withDefaultVibeForgeMcpPermission = (
  config: Config | undefined
) => {
  if (config == null) return undefined

  return {
    ...config,
    permissions: {
      ...(config.permissions ?? {}),
      allow: mergeUniqueList(
        config.permissions?.allow,
        [DEFAULT_VIBE_FORGE_MCP_PERMISSION_NAME]
      )
    }
  } satisfies Config
}

export const mergeDefaultVibeForgeMcpPermissions = (options: {
  runtimeValue?: boolean
  projectConfig?: Config
  userConfig?: Config
}) => {
  if (!resolveUseDefaultVibeForgeMcpServer(options)) {
    return [options.projectConfig, options.userConfig] as const
  }

  if (options.projectConfig != null) {
    return [
      withDefaultVibeForgeMcpPermission(options.projectConfig),
      options.userConfig
    ] as const
  }

  if (options.userConfig != null) {
    return [
      options.projectConfig,
      withDefaultVibeForgeMcpPermission(options.userConfig)
    ] as const
  }

  return [options.projectConfig, options.userConfig] as const
}

const resolvePublishedMcpPackageJsonPath = (packageResolver: NodeJS.Require) => {
  try {
    const appRuntimePackageJsonPath = packageResolver.resolve('@vibe-forge/app-runtime/package.json')
    return createRequire(appRuntimePackageJsonPath).resolve('@vibe-forge/mcp/package.json')
  } catch {
    return packageResolver.resolve('@vibe-forge/mcp/package.json')
  }
}
