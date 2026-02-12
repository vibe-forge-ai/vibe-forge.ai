import './SpecList.scss'

import { List } from 'antd'
import { useTranslation } from 'react-i18next'

import type { SpecSummary } from '#~/api.js'
import { EmptyState } from './EmptyState'
import { KnowledgeList } from './KnowledgeList'
import { LoadingState } from './LoadingState'
import { SpecItem } from './SpecItem'

type SpecListProps = {
  isLoading: boolean
  specs: SpecSummary[]
  filteredSpecs: SpecSummary[]
  onCreate: () => void
}

export function SpecList({
  isLoading,
  specs,
  filteredSpecs,
  onCreate
}: SpecListProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className='knowledge-base-view__spec-list'>
        <LoadingState />
      </div>
    )
  }

  if (specs.length === 0) {
    return (
      <div className='knowledge-base-view__spec-list'>
        <EmptyState
          description={t('knowledge.flows.empty')}
          actionLabel={t('knowledge.flows.create')}
          onAction={onCreate}
        />
      </div>
    )
  }

  if (filteredSpecs.length === 0) {
    return (
      <div className='knowledge-base-view__spec-list'>
        <EmptyState
          description={t('knowledge.filters.noResults')}
          variant='simple'
        />
      </div>
    )
  }

  return (
    <div className='knowledge-base-view__spec-list'>
      <KnowledgeList
        data={filteredSpecs}
        renderItem={(spec) => (
          <List.Item className='knowledge-base-view__list-item'>
            <SpecItem spec={spec} />
          </List.Item>
        )}
      />
    </div>
  )
}
