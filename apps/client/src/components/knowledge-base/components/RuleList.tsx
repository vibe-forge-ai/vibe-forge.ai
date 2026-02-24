import './RuleList.scss'

import { List } from 'antd'
import { useTranslation } from 'react-i18next'

import type { RuleSummary } from '#~/api.js'
import { EmptyState } from './EmptyState'
import { KnowledgeList } from './KnowledgeList'
import { LoadingState } from './LoadingState'
import { RuleItem } from './RuleItem'

type RuleListProps = {
  isLoading: boolean
  rules: RuleSummary[]
  filteredRules: RuleSummary[]
  onCreate: () => void
}

export function RuleList({
  isLoading,
  rules,
  filteredRules,
  onCreate
}: RuleListProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className='knowledge-base-view__rule-list'>
        <LoadingState />
      </div>
    )
  }

  if (rules.length === 0) {
    return (
      <div className='knowledge-base-view__rule-list'>
        <EmptyState
          description={t('knowledge.rules.empty')}
          actionLabel={t('knowledge.rules.create')}
          onAction={onCreate}
        />
      </div>
    )
  }

  if (filteredRules.length === 0) {
    return (
      <div className='knowledge-base-view__rule-list'>
        <EmptyState
          description={t('knowledge.filters.noResults')}
          variant='simple'
        />
      </div>
    )
  }

  return (
    <div className='knowledge-base-view__rule-list'>
      <KnowledgeList
        data={filteredRules}
        renderItem={(rule) => (
          <List.Item className='knowledge-base-view__list-item'>
            <RuleItem rule={rule} />
          </List.Item>
        )}
      />
    </div>
  )
}
