import { Button, Empty, Input, List, Select, Spin, Tooltip } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'

import type { SkillHubItem, SkillHubRegistrySummary } from '#~/api.js'
import { EmptyState } from './EmptyState'
import { SkillHubResultItem } from './SkillHubResultItem'
import { SkillRegistryErrors } from './SkillRegistryErrors'

interface SkillMarketViewProps {
  hubItems: SkillHubItem[]
  installingId: string | null
  isLoading: boolean
  query: string
  registries: SkillHubRegistrySummary[]
  registry: string
  registryOptions: Array<{ label: string; value: string }>
  skillCount: number
  onAddRegistry: () => void
  onInstall: (item: SkillHubItem) => void
  onQueryChange: (value: string) => void
  onRegistryChange: (value: string) => void
}

export function SkillMarketView({
  hubItems,
  installingId,
  isLoading,
  query,
  registries,
  registry,
  registryOptions,
  skillCount,
  onAddRegistry,
  onInstall,
  onQueryChange,
  onRegistryChange
}: SkillMarketViewProps) {
  const { t } = useTranslation()
  const [actionsOpen, setActionsOpen] = React.useState(false)
  const hasRegistryFilter = registry !== 'all'
  const registryChevron = <span className='material-symbols-rounded knowledge-base-view__select-chevron'>
    expand_more
  </span>

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
                  hasRegistryFilter ? 'has-active-filters' : ''
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
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>
      <div className={`knowledge-base-view__skill-market-actions ${actionsOpen ? 'is-open' : ''}`}>
        <div className='knowledge-base-view__skill-market-actions-inner'>
          <div className='knowledge-base-view__skill-registry-filter'>
            <span className='material-symbols-rounded knowledge-base-view__toolbar-filter-icon'>source</span>
            <Select
              className='knowledge-base-view__skill-registry-select'
              value={registry}
              options={registryOptions}
              suffixIcon={registryChevron}
              onChange={onRegistryChange}
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
        </div>
      </div>
      <SkillRegistryErrors registries={registries} />
      {isLoading && (
        <div className='knowledge-base-view__loading'>
          <Spin />
        </div>
      )}
      {!isLoading && hubItems.length > 0 && (
        <List
          className='knowledge-base-view__list'
          dataSource={hubItems}
          renderItem={(item) => (
            <SkillHubResultItem
              item={item}
              installing={installingId === item.id}
              onInstall={onInstall}
            />
          )}
        />
      )}
      {!isLoading && hubItems.length === 0 && skillCount > 0 && (
        <div className='knowledge-base-view__empty-simple'>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('knowledge.filters.noResults')} />
        </div>
      )}
      {!isLoading && hubItems.length === 0 && skillCount === 0 && (
        <EmptyState
          description={registries.length === 0 ? t('knowledge.skills.noRegistry') : t('knowledge.skills.empty')}
          actionLabel={registries.length === 0 ? t('knowledge.skills.addRegistry') : undefined}
          onAction={registries.length === 0 ? onAddRegistry : undefined}
        />
      )}
    </>
  )
}
