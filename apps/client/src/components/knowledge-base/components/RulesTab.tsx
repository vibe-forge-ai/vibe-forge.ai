import './RulesTab.scss'

import { Input, Space, Tooltip } from 'antd'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { RuleSummary } from '#~/api.js'
import { ActionButton } from './ActionButton'
import { RuleList } from './RuleList'
import { SectionHeader } from './SectionHeader'
import { TabContent } from './TabContent'

interface RulesTabProps {
  rules: RuleSummary[]
  filteredRules: RuleSummary[]
  hideContentSearch?: boolean
  isLoading: boolean
  leading?: ReactNode
  query: string
  onRefresh: () => void
  onQueryChange: (value: string) => void
  onCreate: () => void
  onImport: () => void
}

export function RulesTab({
  rules,
  filteredRules,
  hideContentSearch = false,
  isLoading,
  leading,
  query,
  onRefresh,
  onQueryChange,
  onCreate,
  onImport
}: RulesTabProps) {
  const { t } = useTranslation()

  return (
    <TabContent className='knowledge-base-view__rules-tab'>
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
      {!hideContentSearch && (
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
      )}
      <RuleList
        isLoading={isLoading}
        rules={rules}
        filteredRules={filteredRules}
        onCreate={onCreate}
      />
    </TabContent>
  )
}
