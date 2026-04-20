import type { Config, MdpConfig, MdpConnectionConfig, MdpFilterConfig, MdpWorkspaceProjectionConfig } from '@vibe-forge/types'

export const DEFAULT_MDP_SERVER_HOST = 'ws://127.0.0.1:47372'
export const DEFAULT_MDP_CONNECTION_KEY = 'default'

export interface ResolvedMdpConnection {
  key: string
  title?: string
  description?: string
  hosts: string[]
  auth?: MdpConnectionConfig['auth']
}

export interface ResolvedMdpConfig {
  enabled: boolean
  noDefaultBridge: boolean
  connections: ResolvedMdpConnection[]
  filters: Required<MdpFilterConfig>
  workspaceProjection: Required<MdpWorkspaceProjectionConfig>
}

const normalizeStringArray = (value: string[] | undefined) => (
  Array.from(
    new Set(
      (value ?? [])
        .map(item => item.trim())
        .filter(item => item !== '')
    )
  )
)

const resolveConnectionHosts = (connection: MdpConnectionConfig | undefined) => {
  const hosts = normalizeStringArray(connection?.hosts)
  return hosts.length > 0 ? hosts : [DEFAULT_MDP_SERVER_HOST]
}

const resolveConnections = (mdp: MdpConfig | undefined): ResolvedMdpConnection[] => {
  const entries = Object.entries(mdp?.connections ?? {})
    .filter(([, connection]) => connection?.enabled !== false)

  if (entries.length === 0) {
    return [
      {
        key: DEFAULT_MDP_CONNECTION_KEY,
        hosts: [DEFAULT_MDP_SERVER_HOST]
      }
    ]
  }

  return entries.map(([key, connection]) => ({
    key,
    title: connection?.title,
    description: connection?.description,
    hosts: resolveConnectionHosts(connection),
    auth: connection?.auth
  }))
}

export const resolveMdpConfig = (config: Pick<Config, 'mdp'> | undefined): ResolvedMdpConfig => {
  const mdp = config?.mdp
  const filters = mdp?.filters
  const workspaceProjection = mdp?.workspaceProjection

  return {
    enabled: mdp?.enabled !== false,
    noDefaultBridge: mdp?.noDefaultBridge === true,
    connections: resolveConnections(mdp),
    filters: {
      excludeClientIds: normalizeStringArray(filters?.excludeClientIds),
      excludeNames: normalizeStringArray(filters?.excludeNames),
      excludePaths: normalizeStringArray(filters?.excludePaths)
    },
    workspaceProjection: {
      enabled: workspaceProjection?.enabled !== false,
      includeWorkspaceSkills: workspaceProjection?.includeWorkspaceSkills !== false,
      includePluginSkills: workspaceProjection?.includePluginSkills !== false,
      includeSkillIds: normalizeStringArray(workspaceProjection?.includeSkillIds),
      excludeSkillIds: normalizeStringArray(workspaceProjection?.excludeSkillIds)
    }
  }
}
