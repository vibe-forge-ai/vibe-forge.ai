import './FilterBar.scss'

import { Input, Select } from 'antd'

type FilterOption = {
  label: string
  value: string
}

type FilterBarProps = {
  query: string
  tagOptions: FilterOption[]
  tagFilter: string[]
  searchPlaceholder: string
  tagsPlaceholder: string
  onQueryChange: (value: string) => void
  onTagFilterChange: (value: string[]) => void
}

export function FilterBar({
  query,
  tagOptions,
  tagFilter,
  searchPlaceholder,
  tagsPlaceholder,
  onQueryChange,
  onTagFilterChange
}: FilterBarProps) {
  return (
    <div className='knowledge-base-view__filters'>
      <Input
        className='knowledge-base-view__filter-input'
        prefix={<span className='material-symbols-rounded knowledge-base-view__filter-icon'>search</span>}
        placeholder={searchPlaceholder}
        allowClear
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
      />
      <Select
        className='knowledge-base-view__filter-select'
        mode='multiple'
        placeholder={tagsPlaceholder}
        options={tagOptions}
        value={tagFilter}
        onChange={onTagFilterChange}
        maxTagCount='responsive'
        disabled={tagOptions.length === 0}
      />
    </div>
  )
}
