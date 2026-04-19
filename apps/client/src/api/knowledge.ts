import { createApiUrl, fetchApiJson } from './base'

export interface SpecSummary {
  id: string
  name: string
  description: string
  params: { name: string; description?: string }[]
  always: boolean
  tags: string[]
  skills: string[]
  rules: string[]
}

export interface EntitySummary {
  id: string
  name: string
  description: string
  always: boolean
  tags: string[]
  skills: string[]
  rules: string[]
}

export interface RuleSummary {
  id: string
  name: string
  description: string
  always: boolean
  globs?: string[]
}

export interface SkillSummary {
  id: string
  name: string
  description: string
  always: boolean
  instancePath?: string
}

export interface SpecDetail extends SpecSummary {
  body: string
}

export interface EntityDetail extends EntitySummary {
  body: string
}

export interface RuleDetail extends RuleSummary {
  body: string
}

export interface SkillDetail extends SkillSummary {
  body: string
}

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

export async function listSpecs(): Promise<{ specs: SpecSummary[] }> {
  return fetchApiJson<{ specs: SpecSummary[] }>('/api/ai/specs')
}

export async function listSkills(): Promise<{ skills: SkillSummary[] }> {
  return fetchApiJson<{ skills: SkillSummary[] }>('/api/ai/skills')
}

export async function createSkill(params: {
  name: string
  description?: string
  body?: string
}): Promise<{ skill: SkillDetail }> {
  return fetchApiJson<{ skill: SkillDetail }>('/api/ai/skills', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  })
}

export async function importSkillArchive(file: File): Promise<{ fileCount: number; targetDir: string }> {
  return fetchApiJson<{ fileCount: number; targetDir: string }>('/api/ai/skills/import', {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'x-file-name': encodeURIComponent(file.name)
    },
    body: file
  })
}

export async function listEntities(): Promise<{ entities: EntitySummary[] }> {
  return fetchApiJson<{ entities: EntitySummary[] }>('/api/ai/entities')
}

export async function listRules(): Promise<{ rules: RuleSummary[] }> {
  return fetchApiJson<{ rules: RuleSummary[] }>('/api/ai/rules')
}

export async function getSpecDetail(path: string): Promise<{ spec: SpecDetail }> {
  const url = createApiUrl('/api/ai/specs/detail')
  url.searchParams.set('path', path)
  return fetchApiJson<{ spec: SpecDetail }>(url)
}

export async function getEntityDetail(path: string): Promise<{ entity: EntityDetail }> {
  const url = createApiUrl('/api/ai/entities/detail')
  url.searchParams.set('path', path)
  return fetchApiJson<{ entity: EntityDetail }>(url)
}

export async function getRuleDetail(path: string): Promise<{ rule: RuleDetail }> {
  const url = createApiUrl('/api/ai/rules/detail')
  url.searchParams.set('path', path)
  return fetchApiJson<{ rule: RuleDetail }>(url)
}

export async function getSkillDetail(path: string): Promise<{ skill: SkillDetail }> {
  const url = createApiUrl('/api/ai/skills/detail')
  url.searchParams.set('path', path)
  return fetchApiJson<{ skill: SkillDetail }>(url)
}

export async function searchSkillHub(params: {
  registry?: string
  query?: string
} = {}): Promise<SkillHubSearchResult> {
  const url = createApiUrl('/api/skill-hub/search')
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
