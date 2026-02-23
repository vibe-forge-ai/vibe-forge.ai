import './EntitiesTab.scss'

import { Space } from 'antd'
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
  isLoading: boolean
  query: string
  tagOptions: Array<{ label: string; value: string }>
  tagFilter: string[]
  onQueryChange: (value: string) => void
  onTagFilterChange: (value: string[]) => void
  onCreate: () => void
  onImport: () => void
}

export function EntitiesTab({
  entities,
  filteredEntities,
  isLoading,
  query,
  tagOptions,
  tagFilter,
  onQueryChange,
  onTagFilterChange,
  onCreate,
  onImport
}: EntitiesTabProps) {
  const { t } = useTranslation()

  return (
    <TabContent className='knowledge-base-view__entities-tab'>
      <SectionHeader
        title={t('knowledge.entities.title')}
        description={t('knowledge.entities.desc')}
        actions={(
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
              {t('knowledge.entities.create')}
            </ActionButton>
          </Space>
        )}
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
      <EntityList
        isLoading={isLoading}
        entities={entities}
        filteredEntities={filteredEntities}
        onCreate={onCreate}
      />
    </TabContent>
  )
}
