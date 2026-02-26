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

export interface SpecDetail extends SpecSummary {
  body: string
}

export interface EntityDetail extends EntitySummary {
  body: string
}

export interface RuleDetail extends RuleSummary {
  body: string
}

export async function listSpecs(): Promise<{ specs: SpecSummary[] }> {
  return fetchApiJson<{ specs: SpecSummary[] }>('/api/ai/specs')
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
