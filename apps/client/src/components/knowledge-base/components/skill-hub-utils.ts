import type { SkillSummary } from '#~/api.js'

export interface RegistryFormValues {
  id: string
  source: 'url' | 'directory' | 'github' | 'git'
  value: string
}

export const ALL_REGISTRIES = 'all'

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
