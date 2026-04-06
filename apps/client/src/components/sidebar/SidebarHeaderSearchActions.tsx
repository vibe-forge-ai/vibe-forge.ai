import { Button, Checkbox, Input, Popconfirm, Select, Tooltip } from 'antd'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

interface SidebarHeaderSearchActionsProps {
  adapterFilters: string[]
  availableAdapters: string[]
  availableTags: string[]
  hasActiveFilterConditions: boolean
  isBatchMode: boolean
  searchQuery: string
  selectedCount: number
  shouldShowSearchActions: boolean
  tagFilters: string[]
  totalCount: number
  onAdapterFilterChange: (filters: string[]) => void
  onBatchArchive: () => void
  onBatchDelete: () => void
  onBatchStar: () => void
  onSearchChange: (query: string) => void
  onSelectAll: (selected: boolean) => void
  onTagFilterChange: (tags: string[]) => void
  onToggleBatchMode: () => void
  onToggleSearchActions: () => void
}

export function SidebarHeaderSearchActions({
  adapterFilters,
  availableAdapters,
  availableTags,
  hasActiveFilterConditions,
  isBatchMode,
  searchQuery,
  selectedCount,
  shouldShowSearchActions,
  tagFilters,
  totalCount,
  onAdapterFilterChange,
  onBatchArchive,
  onBatchDelete,
  onBatchStar,
  onSearchChange,
  onSelectAll,
  onTagFilterChange,
  onToggleBatchMode,
  onToggleSearchActions
}: SidebarHeaderSearchActionsProps) {
  const { t } = useTranslation()
  const isAllSelected = totalCount > 0 && selectedCount === totalCount
  const toOptions = useMemo(() => (values: string[]) => values.map((value) => ({ label: value, value })), [])
  const filterSuffixIcon = <span className='material-symbols-rounded toolbar-filter-chevron'>expand_more</span>
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
              <Tooltip title={t('common.searchActions')}>
                <button
                  type='button'
                  className={`search-toggle-button ${shouldShowSearchActions ? 'is-open' : ''} ${
                    hasActiveFilterConditions ? 'has-active-filters' : ''
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
                  <Tooltip title={t('common.cancelBatch')}>
                    <Button
                      className='sidebar-tool-btn is-icon-only'
                      type='text'
                      onClick={onToggleBatchMode}
                      icon={<span className='material-symbols-rounded'>close</span>}
                    />
                  </Tooltip>
                )
                : (
                  <Tooltip title={t('common.batchMode')}>
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
              <div className='toolbar-filter-control'>
                <span className='material-symbols-rounded toolbar-filter-icon'>sell</span>
                <Select
                  className='toolbar-filter-select'
                  mode='tags'
                  placeholder={t('common.allTags')}
                  options={toOptions(availableTags)}
                  value={tagFilters}
                  onChange={onTagFilterChange}
                  maxTagCount={1}
                  allowClear
                  suffixIcon={filterSuffixIcon}
                  tokenSeparators={[',']}
                />
              </div>
              <div className='toolbar-filter-control'>
                <span className='material-symbols-rounded toolbar-filter-icon'>extension</span>
                <Select
                  className='toolbar-filter-select'
                  mode='tags'
                  placeholder={t('common.allAdapters')}
                  options={toOptions(availableAdapters)}
                  value={adapterFilters}
                  onChange={onAdapterFilterChange}
                  maxTagCount={1}
                  allowClear
                  suffixIcon={filterSuffixIcon}
                  tokenSeparators={[',']}
                />
              </div>
            </div>
          </div>
          {isBatchMode && (
            <div className='header-batch-actions'>
              <Tooltip title={isAllSelected ? t('common.deselectAll') : t('common.selectAll')}>
                <label className='batch-select-toggle'>
                  <Checkbox
                    checked={isAllSelected}
                    indeterminate={selectedCount > 0 && selectedCount < totalCount}
                    onChange={(e) => onSelectAll(e.target.checked)}
                  />
                </label>
              </Tooltip>
              <Tooltip title={t('common.star')}>
                <Button
                  className='sidebar-tool-btn is-icon-only'
                  type='text'
                  disabled={selectedCount === 0}
                  onClick={onBatchStar}
                  icon={<span className='material-symbols-rounded'>star</span>}
                />
              </Tooltip>
              <Popconfirm
                title={t('common.archiveConfirm', { count: selectedCount })}
                onConfirm={onBatchArchive}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                okButtonProps={{ danger: false }}
                disabled={selectedCount === 0}
              >
                <Tooltip title={t('common.archive')}>
                  <Button
                    className='sidebar-tool-btn is-icon-only'
                    type='text'
                    disabled={selectedCount === 0}
                    icon={<span className='material-symbols-rounded'>archive</span>}
                  />
                </Tooltip>
              </Popconfirm>
              <Popconfirm
                title={t('common.deleteConfirm', { count: selectedCount })}
                onConfirm={onBatchDelete}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                okButtonProps={{ danger: true }}
                disabled={selectedCount === 0}
              >
                <Tooltip title={t('common.delete')}>
                  <Button
                    className='sidebar-tool-btn is-icon-only is-danger'
                    type='text'
                    disabled={selectedCount === 0}
                    icon={<span className='material-symbols-rounded'>delete</span>}
                  />
                </Tooltip>
              </Popconfirm>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
