export interface SkillHubRegistrySummary {
  id: string
  type: 'claude-code'
  enabled: boolean
  searchable: boolean
  source: string
  pluginCount?: number
  error?: string
}

export interface SkillHubItem {
  id: string
  registry: string
  name: string
  description?: string
  version?: string
  skills: string[]
  commands: string[]
  agents: string[]
  mcpServers: string[]
  hasHooks: boolean
  installed: boolean
  installScope?: string
  installedAt?: string
}

export interface SkillHubSearchResult {
  registries: SkillHubRegistrySummary[]
  items: SkillHubItem[]
}

export interface SkillHubInstallResult {
  registry: string
  plugin: string
  name: string
  scope?: string
  installedAt: string
  installDir: string
}
