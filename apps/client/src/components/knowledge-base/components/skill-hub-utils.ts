import type { SkillHubItem, SkillSummary } from '#~/api.js'

export interface RegistryFormValues {
  id: string
  source: 'url' | 'directory' | 'github' | 'git'
  value: string
}

export const ALL_REGISTRIES = 'all'
export const ALL_SKILL_SOURCES = 'all'

export type SkillHubInstallFilter = 'all' | 'installed' | 'notInstalled'
export type SkillHubSortKey = 'default' | 'installsDesc' | 'nameAsc' | 'nameDesc'

export const isSkillHubInstallFilter = (value: string): value is SkillHubInstallFilter => (
  value === 'all' || value === 'installed' || value === 'notInstalled'
)

export const isSkillHubSortKey = (value: string): value is SkillHubSortKey => (
  value === 'default' || value === 'installsDesc' || value === 'nameAsc' || value === 'nameDesc'
)

export const buildRegistrySource = (values: RegistryFormValues) => {
  const value = values.value.trim()
  switch (values.source) {
    case 'directory':
      return { source: 'directory' as const, path: value }
    case 'github':
      return { source: 'github' as const, repo: value }
    case 'git':
      return { source: 'git' as const, url: value }
    case 'url':
      return { source: 'url' as const, url: value }
  }
}

export const buildPluginsWithRegistry = (
  projectPlugins: Record<string, unknown>,
  id: string,
  source: ReturnType<typeof buildRegistrySource>
) => ({
  ...projectPlugins,
  marketplaces: {
    ...(projectPlugins.marketplaces as Record<string, unknown> | undefined),
    [id]: {
      type: 'claude-code',
      enabled: true,
      options: { source }
    }
  }
})

export const getSourcePlaceholderKey = (source: RegistryFormValues['source'] | undefined) => {
  switch (source) {
    case 'directory':
      return 'knowledge.skills.registryPathPlaceholder'
    case 'github':
      return 'knowledge.skills.registryGithubPlaceholder'
    case 'git':
      return 'knowledge.skills.registryGitPlaceholder'
    case 'url':
    default:
      return 'knowledge.skills.registryUrlPlaceholder'
  }
}

export const joinValues = (values: string[]) => values.filter(Boolean).join(' · ')

export const filterProjectSkills = (skills: SkillSummary[], query: string) => {
  const normalizedQuery = query.trim().toLowerCase()
  if (normalizedQuery === '') return skills

  return skills.filter(skill => {
    const haystack = `${skill.name} ${skill.description} ${skill.id}`.toLowerCase()
    return haystack.includes(normalizedQuery)
  })
}

export const getSkillHubItemSource = (item: SkillHubItem) => item.source ?? item.registry

export const filterAndSortSkillHubItems = (
  items: SkillHubItem[],
  options: {
    sourceFilter: string
    installFilter: SkillHubInstallFilter
    sortKey: SkillHubSortKey
  }
) => {
  const filtered = items.filter((item) => {
    if (options.sourceFilter !== ALL_SKILL_SOURCES && getSkillHubItemSource(item) !== options.sourceFilter) {
      return false
    }
    if (options.installFilter === 'installed' && !item.installed) return false
    if (options.installFilter === 'notInstalled' && item.installed) return false
    return true
  })

  switch (options.sortKey) {
    case 'installsDesc':
      return [...filtered].sort((left, right) => (right.installs ?? -1) - (left.installs ?? -1))
    case 'nameAsc':
      return [...filtered].sort((left, right) => left.name.localeCompare(right.name))
    case 'nameDesc':
      return [...filtered].sort((left, right) => right.name.localeCompare(left.name))
    case 'default':
      return filtered
  }
}
