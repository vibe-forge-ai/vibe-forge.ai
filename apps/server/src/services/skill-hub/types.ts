export interface SkillHubRegistrySummary {
  id: string
  type: 'claude-code' | 'skills-sh'
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
  installRef?: string
  source?: string
  detailUrl?: string
  installs?: number
}

export interface SkillHubSearchResult {
  hasMore?: boolean
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

export interface SkillsCliSearchResult {
  source: string
  items: SkillHubItem[]
  hasMore?: boolean
  total?: number
  error?: string
}

export interface SkillsCliInstallResult {
  source: string
  skill: string
  name: string
  installedAt: string
  installDir: string
}
