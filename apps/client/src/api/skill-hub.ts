import { createApiUrl, fetchApiJson } from './base'

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

export async function searchSkillHub(params: {
  limit?: number
  registry?: string
  query?: string
} = {}): Promise<SkillHubSearchResult> {
  const url = createApiUrl('/api/skill-hub/search')
  if (params.limit != null) {
    url.searchParams.set('limit', String(params.limit))
  }
  if (params.registry != null && params.registry !== '') {
    url.searchParams.set('registry', params.registry)
  }
  if (params.query != null && params.query !== '') {
    url.searchParams.set('q', params.query)
  }
  return fetchApiJson<SkillHubSearchResult>(url)
}

export async function installSkillHubItem(params: {
  registry: string
  plugin: string
  force?: boolean
  scope?: string
}): Promise<SkillHubInstallResult> {
  return fetchApiJson<SkillHubInstallResult>('/api/skill-hub/install', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  })
}

export async function searchSkillsCli(params: {
  limit?: number
  registry?: string
  source: string
  query?: string
}): Promise<SkillsCliSearchResult> {
  const url = createApiUrl('/api/skill-hub/skills-cli/search')
  url.searchParams.set('source', params.source)
  if (params.limit != null) {
    url.searchParams.set('limit', String(params.limit))
  }
  if (params.query != null && params.query !== '') {
    url.searchParams.set('q', params.query)
  }
  if (params.registry != null && params.registry !== '') {
    url.searchParams.set('registry', params.registry)
  }
  return fetchApiJson<SkillsCliSearchResult>(url)
}

export async function installSkillsCliItem(params: {
  registry?: string
  source: string
  skill: string
  force?: boolean
}): Promise<SkillsCliInstallResult> {
  return fetchApiJson<SkillsCliInstallResult>('/api/skill-hub/skills-cli/install', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  })
}
