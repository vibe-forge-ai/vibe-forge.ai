import { useMemo } from 'react'

import { useQueryParams } from '#~/hooks/useQueryParams.js'

const splitFilterValues = (raw: string) => {
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    )
  )
}

const joinFilterValues = (values: string[]) => {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean)
    )
  ).join(',')
}

export function useSidebarQueryState() {
  const { values, update } = useQueryParams<{
    adapter: string
    search: string
    sidebar: string
    tag: string
  }>({
    keys: ['sidebar', 'search', 'tag', 'adapter'],
    defaults: {
      sidebar: '',
      search: '',
      tag: '',
      adapter: ''
    },
    omit: {
      sidebar: (value) => value === '',
      search: (value) => value === '',
      tag: (value) => value === '',
      adapter: (value) => value === ''
    }
  })

  const tagFilters = useMemo(() => splitFilterValues(values.tag), [values.tag])
  const adapterFilters = useMemo(() => splitFilterValues(values.adapter), [values.adapter])
  const searchQuery = values.search
  const isSidebarCollapsed = values.sidebar === 'collapsed'
  const hasActiveFilterConditions = searchQuery.trim() !== '' || tagFilters.length > 0 || adapterFilters.length > 0

  return {
    adapterFilters,
    hasActiveFilterConditions,
    isSidebarCollapsed,
    searchQuery,
    setAdapterFilters: (filters: string[]) => update({ adapter: joinFilterValues(filters) }),
    setSearchQuery: (search: string) => update({ search }),
    setSidebarCollapsed: (collapsed: boolean) => update({ sidebar: collapsed ? 'collapsed' : '' }),
    setTagFilters: (filters: string[]) => update({ tag: joinFilterValues(filters) }),
    tagFilters
  }
}
