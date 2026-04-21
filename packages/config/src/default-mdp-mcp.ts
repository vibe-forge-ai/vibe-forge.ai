import type { Config } from '@vibe-forge/types'
import { mergeUniqueList } from './merge'

export const DEFAULT_MDP_LIST_PATHS_PERMISSION_NAME = 'mcp-mdp-listpaths'
export const DEFAULT_MDP_LIST_CLIENTS_PERMISSION_NAME = 'mcp-mdp-listclients'
export const DEFAULT_MDP_READ_SKILL_PERMISSION_NAME = 'mcp-mdp-callpath-get-skill'

export const resolveUseDefaultMdpBridge = (options: {
  projectConfig?: Config
  userConfig?: Config
}) => (
  (options.userConfig?.mdp?.noDefaultBridge != null
    ? !options.userConfig.mdp.noDefaultBridge
    : undefined) ??
  (options.projectConfig?.mdp?.noDefaultBridge != null
    ? !options.projectConfig.mdp.noDefaultBridge
    : undefined) ??
  true
)

const withDefaultMdpBridgePermissions = (config: Config | undefined) => {
  if (config == null) return undefined

  return {
    ...config,
    permissions: {
      ...(config.permissions ?? {}),
      allow: mergeUniqueList(
        config.permissions?.allow,
        [
          DEFAULT_MDP_LIST_CLIENTS_PERMISSION_NAME,
          DEFAULT_MDP_LIST_PATHS_PERMISSION_NAME,
          DEFAULT_MDP_READ_SKILL_PERMISSION_NAME
        ]
      )
    }
  } satisfies Config
}

export const mergeDefaultMdpBridgePermissions = (options: {
  projectConfig?: Config
  userConfig?: Config
}) => {
  if (!resolveUseDefaultMdpBridge(options)) {
    return [options.projectConfig, options.userConfig] as const
  }

  if (options.projectConfig != null) {
    return [
      withDefaultMdpBridgePermissions(options.projectConfig),
      options.userConfig
    ] as const
  }

  if (options.userConfig != null) {
    return [
      options.projectConfig,
      withDefaultMdpBridgePermissions(options.userConfig)
    ] as const
  }

  return [options.projectConfig, options.userConfig] as const
}
