import './EntityList.scss'

import { List } from 'antd'
import { useTranslation } from 'react-i18next'

import type { EntitySummary } from '#~/api.js'
import { EmptyState } from './EmptyState'
import { EntityItem } from './EntityItem'
import { KnowledgeList } from './KnowledgeList'
import { LoadingState } from './LoadingState'

type EntityListProps = {
  isLoading: boolean
  entities: EntitySummary[]
  filteredEntities: EntitySummary[]
  onCreate: () => void
}

export function EntityList({
  isLoading,
  entities,
  filteredEntities,
  onCreate
}: EntityListProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className='knowledge-base-view__entity-list'>
        <LoadingState />
      </div>
    )
  }

  if (entities.length === 0) {
    return (
      <div className='knowledge-base-view__entity-list'>
        <EmptyState
          description={t('knowledge.entities.empty')}
          actionLabel={t('knowledge.entities.create')}
          onAction={onCreate}
        />
      </div>
    )
  }

  if (filteredEntities.length === 0) {
    return (
      <div className='knowledge-base-view__entity-list'>
        <EmptyState
          description={t('knowledge.filters.noResults')}
          variant='simple'
        />
      </div>
    )
  }

  return (
    <div className='knowledge-base-view__entity-list'>
      <KnowledgeList
        data={filteredEntities}
        renderItem={(entity) => (
          <List.Item className='knowledge-base-view__list-item'>
            <EntityItem entity={entity} />
          </List.Item>
        )}
      />
    </div>
  )
}
