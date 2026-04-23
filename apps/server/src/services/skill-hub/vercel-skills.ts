import { readProjectSkillNames } from './project-skills'
import type { SkillHubItem, SkillHubRegistrySummary } from './types'
import { SKILLS_API_BASE, VERCEL_SKILLS_REGISTRY_ID, fetchSkillsJson } from './vercel-skills-common'
export { VERCEL_SKILLS_REGISTRY_ID } from './vercel-skills-common'
export { installVercelSkill } from './vercel-skills-install'

const MIN_SEARCH_QUERY_LENGTH = 2
const DEFAULT_SEARCH_LIMIT = 100
const MAX_SEARCH_LIMIT = 500

interface SkillsSearchItem {
  id: string
  skillId: string
  name: string
  source: string
  installs?: number
}

interface SkillsSearchResponse {
  skills: SkillsSearchItem[]
  count?: number
}

const registrySummary = (pluginCount?: number, error?: string): SkillHubRegistrySummary => ({
  id: VERCEL_SKILLS_REGISTRY_ID,
  type: 'skills-sh',
  enabled: true,
  searchable: true,
  source: SKILLS_API_BASE,
  ...(pluginCount != null ? { pluginCount } : {}),
  ...(error != null ? { error } : {})
})

const toErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error)

const normalizeSearchLimit = (limit: number | undefined) => {
  if (limit == null || !Number.isFinite(limit)) return DEFAULT_SEARCH_LIMIT
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_SEARCH_LIMIT)
}

export const searchVercelSkills = async (params: {
  limit?: number
  query?: string
  workspaceFolder: string
}): Promise<{ hasMore: boolean; registry: SkillHubRegistrySummary; items: SkillHubItem[] }> => {
  const query = params.query?.trim() ?? ''
  if (query.length < MIN_SEARCH_QUERY_LENGTH) {
    return { hasMore: false, registry: registrySummary(), items: [] }
  }
  const limit = normalizeSearchLimit(params.limit)

  try {
    const url = new URL('/api/search', SKILLS_API_BASE)
    url.searchParams.set('q', query)
    url.searchParams.set('limit', String(limit))
    const [result, installedNames] = await Promise.all([
      fetchSkillsJson<SkillsSearchResponse>(url.toString()),
      readProjectSkillNames(params.workspaceFolder)
    ])

    return {
      hasMore: result.skills.length >= limit && limit < MAX_SEARCH_LIMIT,
      registry: registrySummary(result.count),
      items: result.skills.map(skill => ({
        id: `${VERCEL_SKILLS_REGISTRY_ID}:${skill.id}`,
        registry: VERCEL_SKILLS_REGISTRY_ID,
        name: skill.name,
        skills: [skill.skillId],
        commands: [],
        agents: [],
        mcpServers: [],
        hasHooks: false,
        installed: installedNames.has(skill.name) || installedNames.has(skill.skillId),
        installRef: `${skill.source}@${skill.skillId}`,
        source: skill.source,
        detailUrl: `${SKILLS_API_BASE}/${skill.id}`,
        ...(skill.installs != null ? { installs: skill.installs } : {})
      }))
    }
  } catch (error) {
    return {
      hasMore: false,
      registry: registrySummary(undefined, toErrorMessage(error)),
      items: []
    }
  }
}
