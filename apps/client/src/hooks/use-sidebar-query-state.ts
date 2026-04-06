import { useMemo } from 'react'

import { useQueryParams } from '#~/hooks/useQueryParams.js'

export type SidebarSessionSortOrder = 'asc' | 'desc'

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
    sort: string
    sidebar: string
    tag: string
  }>({
    keys: ['sidebar', 'search', 'tag', 'adapter', 'sort'],
    defaults: {
      sidebar: '',
      search: '',
      tag: '',
      adapter: '',
      sort: 'desc'
    },
    omit: {
      sidebar: (value) => value === '',
      search: (value) => value === '',
      tag: (value) => value === '',
      adapter: (value) => value === '',
      sort: (value) => value === '' || value === 'desc'
    }
  })

  const tagFilters = useMemo(() => splitFilterValues(values.tag), [values.tag])
  const adapterFilters = useMemo(() => splitFilterValues(values.adapter), [values.adapter])
  const searchQuery = values.search
  const sortOrder: SidebarSessionSortOrder = values.sort === 'asc' ? 'asc' : 'desc'
  const isSidebarCollapsed = values.sidebar === 'collapsed'
  const hasActiveFilterConditions = searchQuery.trim() !== '' || tagFilters.length > 0 || adapterFilters.length > 0
  const hasActiveSearchControls = hasActiveFilterConditions || sortOrder !== 'desc'

  return {
    adapterFilters,
    hasActiveFilterConditions,
    hasActiveSearchControls,
    isSidebarCollapsed,
    searchQuery,
    setSortOrder: (sort: SidebarSessionSortOrder) => update({ sort }),
    setAdapterFilters: (filters: string[]) => update({ adapter: joinFilterValues(filters) }),
    setSearchQuery: (search: string) => update({ search }),
    setSidebarCollapsed: (collapsed: boolean) => update({ sidebar: collapsed ? 'collapsed' : '' }),
    setTagFilters: (filters: string[]) => update({ tag: joinFilterValues(filters) }),
    sortOrder,
    tagFilters
  }
}
