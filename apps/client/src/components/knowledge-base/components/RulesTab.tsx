import './RulesTab.scss'

import { Input, Space } from 'antd'
import { useTranslation } from 'react-i18next'

import type { RuleSummary } from '#~/api.js'
import { ActionButton } from './ActionButton'
import { RuleList } from './RuleList'
import { SectionHeader } from './SectionHeader'
import { TabContent } from './TabContent'

type RulesTabProps = {
  rules: RuleSummary[]
  filteredRules: RuleSummary[]
  isLoading: boolean
  query: string
  onQueryChange: (value: string) => void
  onCreate: () => void
  onImport: () => void
}

export function RulesTab({
  rules,
  filteredRules,
  isLoading,
  query,
  onQueryChange,
  onCreate,
  onImport
}: RulesTabProps) {
  const { t } = useTranslation()

  return (
    <TabContent className='knowledge-base-view__rules-tab'>
      <SectionHeader
        title={t('knowledge.rules.title')}
        description={t('knowledge.rules.desc')}
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
              {t('knowledge.rules.create')}
            </ActionButton>
          </Space>
        )}
      />
      <div className='knowledge-base-view__filters'>
        <Input
          className='knowledge-base-view__filter-input'
          prefix={<span className='material-symbols-rounded knowledge-base-view__filter-icon'>search</span>}
          placeholder={t('knowledge.filters.search')}
          allowClear
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
      </div>
      <RuleList
        isLoading={isLoading}
        rules={rules}
        filteredRules={filteredRules}
        onCreate={onCreate}
      />
    </TabContent>
  )
}
