import { Button, Input, Tooltip } from 'antd'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useResponsiveLayout } from '#~/hooks/use-responsive-layout'
import type { SidebarSessionSortOrder } from '#~/hooks/use-sidebar-query-state'
import { SidebarHeaderBatchActions } from './SidebarHeaderBatchActions'
import { SidebarHeaderSelectField } from './SidebarHeaderSelectField'

interface SidebarHeaderSearchActionsProps {
  adapterFilters: string[]
  availableAdapters: string[]
  availableTags: string[]
  hasActiveSearchControls: boolean
  isBatchMode: boolean
  searchQuery: string
  selectedCount: number
  shouldShowSearchActions: boolean
  sortOrder: SidebarSessionSortOrder
  sortSelection?: SidebarSessionSortOrder
  tagFilters: string[]
  totalCount: number
  onAdapterFilterChange: (filters: string[]) => void
  onBatchArchive: () => void
  onBatchDelete: () => void
  onBatchStar: () => void
  onSearchChange: (query: string) => void
  onSortOrderChange: (sort?: SidebarSessionSortOrder) => void
  onSelectAll: (selected: boolean) => void
  onTagFilterChange: (tags: string[]) => void
  onToggleBatchMode: () => void
  onToggleSearchActions: () => void
}

export function SidebarHeaderSearchActions({
  adapterFilters,
  availableAdapters,
  availableTags,
  hasActiveSearchControls,
  isBatchMode,
  searchQuery,
  selectedCount,
  shouldShowSearchActions,
  sortOrder,
  sortSelection,
  tagFilters,
  totalCount,
  onAdapterFilterChange,
  onBatchArchive,
  onBatchDelete,
  onBatchStar,
  onSearchChange,
  onSortOrderChange,
  onSelectAll,
  onTagFilterChange,
  onToggleBatchMode,
  onToggleSearchActions
}: SidebarHeaderSearchActionsProps) {
  const { t } = useTranslation()
  const { isTouchInteraction } = useResponsiveLayout()
  const isAllSelected = totalCount > 0 && selectedCount === totalCount
  const toOptions = useMemo(() => (values: string[]) => values.map((value) => ({ label: value, value })), [])
  const filterSuffixIcon = <span className='material-symbols-rounded toolbar-filter-chevron'>expand_more</span>
  const resolveTooltipTitle = (title: string) => isTouchInteraction ? undefined : title
  const sortOptions = useMemo(
    () => [
      { label: t('automation.sortDesc'), value: 'desc' },
      { label: t('automation.sortAsc'), value: 'asc' }
    ],
    [t]
  )

  return (
    <>
      <div className='header-search-row'>
        <div className='search-input-wrap'>
          <Input
            className='search-input'
            placeholder={t('common.search')}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            prefix={<span className='material-symbols-rounded search-icon'>search</span>}
            suffix={
              <Tooltip title={resolveTooltipTitle(t('common.searchActions'))}>
                <button
                  type='button'
                  className={`search-toggle-button ${shouldShowSearchActions ? 'is-open' : ''} ${
                    hasActiveSearchControls ? 'has-active-filters' : ''
                  }`}
                  aria-label={t('common.searchActions')}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={onToggleSearchActions}
                >
                  <span className='material-symbols-rounded search-chevron'>expand_more</span>
                </button>
              </Tooltip>
            }
            allowClear
          />
        </div>
      </div>
      <div className={`header-search-actions ${shouldShowSearchActions ? 'is-open' : ''}`}>
        <div className='header-search-actions-inner'>
          <div className='header-toolbar-row'>
            <div className='header-toolbar-leading'>
              {isBatchMode
                ? (
                  <Tooltip title={resolveTooltipTitle(t('common.cancelBatch'))}>
                    <Button
                      className='sidebar-tool-btn is-icon-only'
                      type='text'
                      onClick={onToggleBatchMode}
                      icon={<span className='material-symbols-rounded'>close</span>}
                    />
                  </Tooltip>
                )
                : (
                  <Tooltip title={resolveTooltipTitle(t('common.batchMode'))}>
                    <Button
                      className='sidebar-tool-btn is-icon-only'
                      type='text'
                      onClick={onToggleBatchMode}
                      icon={<span className='material-symbols-rounded'>checklist</span>}
                    />
                  </Tooltip>
                )}
            </div>
            <div className='header-filter-stack'>
              <SidebarHeaderSelectField
                icon='sell'
                mode='tags'
                placeholder={t('common.allTags')}
                options={toOptions(availableTags)}
                value={tagFilters}
                onChange={(value) => onTagFilterChange(value as string[])}
                maxTagCount={1}
                allowClear
                suffixIcon={filterSuffixIcon}
                tokenSeparators={[',']}
              />
              <SidebarHeaderSelectField
                icon='extension'
                mode='tags'
                placeholder={t('common.allAdapters')}
                options={toOptions(availableAdapters)}
                value={adapterFilters}
                onChange={(value) => onAdapterFilterChange(value as string[])}
                maxTagCount={1}
                allowClear
                suffixIcon={filterSuffixIcon}
                tokenSeparators={[',']}
              />
              <SidebarHeaderSelectField
                icon='swap_vert'
                placeholder={t('common.sort')}
                options={sortOptions}
                value={sortSelection}
                onChange={(value) => onSortOrderChange(value as SidebarSessionSortOrder | undefined)}
                allowClear
                suffixIcon={filterSuffixIcon}
              />
            </div>
          </div>
          {isBatchMode && (
            <SidebarHeaderBatchActions
              isAllSelected={isAllSelected}
              selectedCount={selectedCount}
              totalCount={totalCount}
              onBatchArchive={onBatchArchive}
              onBatchDelete={onBatchDelete}
              onBatchStar={onBatchStar}
              onSelectAll={onSelectAll}
            />
          )}
        </div>
      </div>
    </>
  )
}
