import { Button, Empty, Input, Select, Spin, Tooltip } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from './EmptyState'
import { SkillMarketResults } from './SkillMarketResults'
import type { SkillMarketViewProps } from './SkillMarketView.types'
import { SkillRegistryErrors } from './SkillRegistryErrors'
import { ALL_REGISTRIES, ALL_SKILL_SOURCES } from './skill-hub-utils'
import type { SkillHubInstallFilter, SkillHubSortKey } from './skill-hub-utils'
import { useSkillMarketQueryInput } from './use-skill-market-query-input'

export function SkillMarketView({
  canLoadMore,
  hubItems,
  installingId,
  installFilter,
  isLoading,
  loadingMore,
  query,
  registries,
  registry,
  registryOptions,
  resetKey,
  sortKey,
  sourceFilter,
  sourceOptions,
  onAddRegistry,
  onOpenSkillsCli,
  onInstall,
  onInstallFilterChange,
  onLoadMore,
  onQueryChange,
  onRegistryChange,
  onSortChange,
  onSourceFilterChange
}: SkillMarketViewProps) {
  const { t } = useTranslation()
  const [actionsOpen, setActionsOpen] = React.useState(false)
  const { draftQuery, flushDraftQuery, setDraftQuery } = useSkillMarketQueryInput({
    query,
    onQueryChange
  })
  const hasRegistryFilter = registry !== ALL_REGISTRIES
  const hasSourceFilter = sourceFilter !== ALL_SKILL_SOURCES
  const hasInstallFilter = installFilter !== 'all'
  const hasSort = sortKey !== 'default'
  const hasActiveControls = hasRegistryFilter || hasSourceFilter || hasInstallFilter || hasSort
  const hasSearchCriteria = query.trim() !== '' || hasRegistryFilter || hasSourceFilter || hasInstallFilter
  const registryChevron = <span className='material-symbols-rounded knowledge-base-view__select-chevron'>
    expand_more
  </span>
  const installFilterOptions: Array<{ label: string; value: SkillHubInstallFilter }> = [
    { label: t('knowledge.skills.allStatuses'), value: 'all' },
    { label: t('knowledge.skills.installedOnly'), value: 'installed' },
    { label: t('knowledge.skills.notInstalled'), value: 'notInstalled' }
  ]
  const sortOptions: Array<{ label: string; value: SkillHubSortKey }> = [
    { label: t('knowledge.skills.sortDefault'), value: 'default' },
    { label: t('knowledge.skills.sortInstallsDesc'), value: 'installsDesc' },
    { label: t('knowledge.skills.sortNameAsc'), value: 'nameAsc' },
    { label: t('knowledge.skills.sortNameDesc'), value: 'nameDesc' }
  ]

  return (
    <>
      <div className='knowledge-base-view__skill-market-search-row'>
        <Input
          className='knowledge-base-view__filter-input knowledge-base-view__skill-market-search'
          prefix={<span className='material-symbols-rounded knowledge-base-view__filter-icon'>search</span>}
          suffix={
            <Tooltip title={t('knowledge.skills.marketActions')}>
              <button
                type='button'
                className={`knowledge-base-view__search-toggle-button ${actionsOpen ? 'is-open' : ''} ${
                  hasActiveControls ? 'has-active-filters' : ''
                }`}
                aria-label={t('knowledge.skills.marketActions')}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setActionsOpen((prev) => !prev)}
              >
                <span className='material-symbols-rounded knowledge-base-view__search-chevron'>expand_more</span>
              </button>
            </Tooltip>
          }
          placeholder={t('knowledge.skills.searchHub')}
          allowClear
          value={draftQuery}
          onBlur={() => flushDraftQuery()}
          onChange={(event) => {
            const nextQuery = event.target.value
            setDraftQuery(nextQuery)
            if (nextQuery === '') {
              flushDraftQuery('')
            }
          }}
          onPressEnter={() => flushDraftQuery()}
        />
      </div>
      <div className={`knowledge-base-view__skill-market-actions ${actionsOpen ? 'is-open' : ''}`}>
        <div className='knowledge-base-view__skill-market-actions-inner'>
          <div className='knowledge-base-view__skill-toolbar-field knowledge-base-view__skill-toolbar-field--wide'>
            <span className='material-symbols-rounded knowledge-base-view__toolbar-filter-icon'>source</span>
            <Select
              className='knowledge-base-view__skill-toolbar-select'
              aria-label={t('knowledge.skills.registryFilter')}
              value={registry}
              options={registryOptions}
              suffixIcon={registryChevron}
              onChange={onRegistryChange}
            />
          </div>
          <div className='knowledge-base-view__skill-toolbar-field knowledge-base-view__skill-toolbar-field--wide'>
            <span className='material-symbols-rounded knowledge-base-view__toolbar-filter-icon'>inventory_2</span>
            <Select
              className='knowledge-base-view__skill-toolbar-select'
              aria-label={t('knowledge.skills.sourceFilter')}
              value={sourceFilter}
              options={sourceOptions}
              suffixIcon={registryChevron}
              onChange={onSourceFilterChange}
            />
          </div>
          <div className='knowledge-base-view__skill-toolbar-field'>
            <span className='material-symbols-rounded knowledge-base-view__toolbar-filter-icon'>filter_list</span>
            <Select
              className='knowledge-base-view__skill-toolbar-select'
              aria-label={t('knowledge.skills.installFilter')}
              value={installFilter}
              options={installFilterOptions}
              suffixIcon={registryChevron}
              onChange={onInstallFilterChange}
            />
          </div>
          <div className='knowledge-base-view__skill-toolbar-field'>
            <span className='material-symbols-rounded knowledge-base-view__toolbar-filter-icon'>sort</span>
            <Select
              className='knowledge-base-view__skill-toolbar-select'
              aria-label={t('knowledge.skills.sort')}
              value={sortKey}
              options={sortOptions}
              suffixIcon={registryChevron}
              onChange={onSortChange}
            />
          </div>
          <Tooltip title={t('knowledge.skills.addRegistry')}>
            <Button
              className='knowledge-base-view__icon-button'
              type='text'
              onClick={onAddRegistry}
              icon={<span className='material-symbols-rounded'>add_link</span>}
            />
          </Tooltip>
          <Tooltip title={t('knowledge.skills.installViaSkillsCli')}>
            <Button
              className='knowledge-base-view__icon-button'
              type='text'
              onClick={onOpenSkillsCli}
              icon={<span className='material-symbols-rounded'>terminal</span>}
            />
          </Tooltip>
        </div>
      </div>
      <SkillRegistryErrors registries={registries} />
      {isLoading && (
        <div className='knowledge-base-view__loading'>
          <Spin />
        </div>
      )}
      {!isLoading && hubItems.length > 0 && (
        <SkillMarketResults
          canLoadMore={canLoadMore}
          hubItems={hubItems}
          installingId={installingId}
          loadingMore={loadingMore}
          resetKey={resetKey}
          onInstall={onInstall}
          onLoadMore={onLoadMore}
        />
      )}
      {!isLoading && hubItems.length === 0 && registries.length > 0 && (
        <div className='knowledge-base-view__empty-simple'>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={hasSearchCriteria ? t('knowledge.filters.noResults') : t('knowledge.skills.emptyHub')}
          />
        </div>
      )}
      {!isLoading && hubItems.length === 0 && registries.length === 0 && (
        <EmptyState
          description={t('knowledge.skills.noRegistry')}
          actionLabel={t('knowledge.skills.addRegistry')}
          onAction={onAddRegistry}
        />
      )}
    </>
  )
}
