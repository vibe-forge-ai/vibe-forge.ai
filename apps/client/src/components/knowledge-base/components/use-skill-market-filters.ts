import React from 'react'
import { useTranslation } from 'react-i18next'

import type { SkillHubItem } from '#~/api.js'
import { ALL_SKILL_SOURCES, filterAndSortSkillHubItems, getSkillHubItemSource } from './skill-hub-utils'
import type { SkillHubInstallFilter, SkillHubSortKey } from './skill-hub-utils'

export function useSkillMarketFilters(
  hubItems: SkillHubItem[],
  filters: {
    sourceFilter: string
    installFilter: SkillHubInstallFilter
    sortKey: SkillHubSortKey
  }
) {
  const { t } = useTranslation()
  const sourceOptions = React.useMemo(() => {
    const sources = Array.from(new Set(hubItems.map(getSkillHubItemSource))).sort((left, right) =>
      left.localeCompare(right)
    )
    return [
      { label: t('knowledge.skills.allSources'), value: ALL_SKILL_SOURCES },
      ...sources.map(source => ({ label: source, value: source }))
    ]
  }, [hubItems, t])
  const filteredHubItems = React.useMemo(() =>
    filterAndSortSkillHubItems(hubItems, {
      sourceFilter: filters.sourceFilter,
      installFilter: filters.installFilter,
      sortKey: filters.sortKey
    }), [filters.installFilter, filters.sortKey, filters.sourceFilter, hubItems])

  return {
    filteredHubItems,
    sourceOptions
  }
}
