import type { SkillHubItem, SkillHubRegistrySummary } from '#~/api.js'
import type { SkillHubInstallFilter, SkillHubSortKey } from './skill-hub-utils'

export interface SkillMarketViewProps {
  canLoadMore: boolean
  hubItems: SkillHubItem[]
  installingId: string | null
  installFilter: SkillHubInstallFilter
  isLoading: boolean
  loadingMore: boolean
  query: string
  registries: SkillHubRegistrySummary[]
  registry: string
  registryOptions: Array<{ label: string; value: string }>
  resetKey: string
  sortKey: SkillHubSortKey
  sourceFilter: string
  sourceOptions: Array<{ label: string; value: string }>
  onAddRegistry: () => void
  onInstall: (item: SkillHubItem) => void
  onInstallFilterChange: (value: SkillHubInstallFilter) => void
  onLoadMore: () => void
  onQueryChange: (value: string) => void
  onRegistryChange: (value: string) => void
  onSortChange: (value: SkillHubSortKey) => void
  onSourceFilterChange: (value: string) => void
}
