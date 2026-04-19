import './EntitiesTab.scss'

import { Space, Tooltip } from 'antd'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { EntitySummary } from '#~/api.js'
import { ActionButton } from './ActionButton'
import { EntityList } from './EntityList'
import { FilterBar } from './FilterBar'
import { SectionHeader } from './SectionHeader'
import { TabContent } from './TabContent'

interface EntitiesTabProps {
  entities: EntitySummary[]
  filteredEntities: EntitySummary[]
  hideContentSearch?: boolean
  isLoading: boolean
  leading?: ReactNode
  query: string
  tagOptions: Array<{ label: string; value: string }>
  tagFilter: string[]
  onRefresh: () => void
  onQueryChange: (value: string) => void
  onTagFilterChange: (value: string[]) => void
  onCreate: () => void
  onImport: () => void
}

export function EntitiesTab({
  entities,
  filteredEntities,
  hideContentSearch = false,
  isLoading,
  leading,
  query,
  tagOptions,
  tagFilter,
  onRefresh,
  onQueryChange,
  onTagFilterChange,
  onCreate,
  onImport
}: EntitiesTabProps) {
  const { t } = useTranslation()

  return (
    <TabContent className='knowledge-base-view__entities-tab'>
      <SectionHeader
        actions={
          <Space>
            <Tooltip title={t('knowledge.actions.refresh')}>
              <ActionButton
                icon={<span className='material-symbols-rounded'>refresh</span>}
                onClick={onRefresh}
              />
            </Tooltip>
            <Tooltip title={t('knowledge.actions.import')}>
              <ActionButton
                icon={<span className='material-symbols-rounded'>download</span>}
                onClick={onImport}
              />
            </Tooltip>
          </Space>
        }
        leading={leading}
      />
      <FilterBar
        hideSearch={hideContentSearch}
        query={query}
        tagOptions={tagOptions}
        tagFilter={tagFilter}
        searchPlaceholder={t('knowledge.filters.search')}
        tagsPlaceholder={t('knowledge.filters.tags')}
        onQueryChange={onQueryChange}
        onTagFilterChange={onTagFilterChange}
      />
      <EntityList
        isLoading={isLoading}
        entities={entities}
        filteredEntities={filteredEntities}
        onCreate={onCreate}
      />
    </TabContent>
  )
}
