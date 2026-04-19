import React from 'react'
import useSWR from 'swr'

import { searchSkillHub } from '#~/api.js'
import type { SkillHubInstallFilter, SkillHubSortKey } from './skill-hub-utils'

const INITIAL_LIMIT = 100
const LIMIT_STEP = 100
const MAX_LIMIT = 500

export function useSkillMarketSearch(params: {
  installFilter: SkillHubInstallFilter
  marketQuery: string
  registry: string
  sortKey: SkillHubSortKey
  sourceFilter: string
  viewMode: 'project' | 'market'
}) {
  const [limit, setLimit] = React.useState(INITIAL_LIMIT)
  const { data, isLoading, isValidating, mutate } = useSWR(
    params.viewMode === 'market' ? ['skill-hub-search', params.registry, params.marketQuery, limit] : null,
    () => searchSkillHub({ limit, registry: params.registry, query: params.marketQuery }),
    { keepPreviousData: true }
  )
  const resetKey = [
    params.marketQuery,
    params.registry,
    params.sourceFilter,
    params.installFilter,
    params.sortKey
  ].join('\0')

  React.useEffect(() => {
    setLimit(INITIAL_LIMIT)
  }, [params.marketQuery, params.registry])
  const loadMore = React.useCallback(() => {
    setLimit(value => Math.min(value + LIMIT_STEP, MAX_LIMIT))
  }, [])

  return {
    data,
    isLoading,
    isValidating,
    mutate,
    resetKey,
    canLoadMore: data?.hasMore === true && limit < MAX_LIMIT,
    loadMore
  }
}
