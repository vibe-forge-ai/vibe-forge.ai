import './FlowsTab.scss'

import { Space } from 'antd'
import { useTranslation } from 'react-i18next'

import type { SpecSummary } from '#~/api.js'
import { ActionButton } from './ActionButton'
import { FilterBar } from './FilterBar'
import { SectionHeader } from './SectionHeader'
import { SpecList } from './SpecList'
import { TabContent } from './TabContent'

type FlowsTabProps = {
  specs: SpecSummary[]
  filteredSpecs: SpecSummary[]
  isLoading: boolean
  query: string
  tagOptions: Array<{ label: string; value: string }>
  tagFilter: string[]
  onQueryChange: (value: string) => void
  onTagFilterChange: (value: string[]) => void
  onCreate: () => void
  onImport: () => void
}

export function FlowsTab({
  specs,
  filteredSpecs,
  isLoading,
  query,
  tagOptions,
  tagFilter,
  onQueryChange,
  onTagFilterChange,
  onCreate,
  onImport
}: FlowsTabProps) {
  const { t } = useTranslation()

  return (
    <TabContent className='knowledge-base-view__flows-tab'>
      <SectionHeader
        title={t('knowledge.flows.title')}
        description={t('knowledge.flows.desc')}
        actions={
          <Space>
            <ActionButton
              icon={<span className='material-symbols-rounded'>download</span>}
              onClick={onImport}
            >
              {t('knowledge.actions.import')}
            </ActionButton>
            <ActionButton
              type='primary'
              icon={<span className='material-symbols-rounded'>add_circle</span>}
              onClick={onCreate}
            >
              {t('knowledge.flows.create')}
            </ActionButton>
          </Space>
        }
      />
      <FilterBar
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
