import './FlowsTab.scss'

import { Space, Tooltip } from 'antd'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { SpecSummary } from '#~/api.js'
import { ActionButton } from './ActionButton'
import { FilterBar } from './FilterBar'
import { SectionHeader } from './SectionHeader'
import { SpecList } from './SpecList'
import { TabContent } from './TabContent'

interface FlowsTabProps {
  specs: SpecSummary[]
  filteredSpecs: SpecSummary[]
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

export function FlowsTab({
  specs,
  filteredSpecs,
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
}: FlowsTabProps) {
  const { t } = useTranslation()

  return (
    <TabContent className='knowledge-base-view__flows-tab'>
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
      <SpecList
        isLoading={isLoading}
        specs={specs}
        filteredSpecs={filteredSpecs}
        onCreate={onCreate}
      />
    </TabContent>
  )
}
