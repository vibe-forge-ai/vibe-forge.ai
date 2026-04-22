import { Button, Input, Tooltip } from 'antd'
import { useTranslation } from 'react-i18next'

export interface KnowledgeSectionNavItem {
  count: number
  description: string
  icon: string
  key: string
  label: string
}

interface KnowledgeSidebarProps {
  activeKey: string
  collapsed: boolean
  isCompact: boolean
  searchPlaceholder: string
  searchValue: string
  sections: KnowledgeSectionNavItem[]
  onCreate: () => void
  onSearchChange: (value: string) => void
  onSelect: (key: string) => void
  onToggleCollapsed: () => void
}

export function KnowledgeSidebar({
  activeKey,
  collapsed,
  isCompact,
  searchPlaceholder,
  searchValue,
  sections,
  onCreate,
  onSearchChange,
  onSelect,
  onToggleCollapsed
}: KnowledgeSidebarProps) {
  const { t } = useTranslation()

  if (isCompact) return null

  return (
    <div className={`knowledge-base-view__left ${collapsed ? 'is-collapsed' : ''}`}>
      <div className='knowledge-base-view__sidebar'>
        <div className='knowledge-base-view__sidebar-top'>
          <Button
            className='knowledge-base-view__new-button'
            type='primary'
            block
            onClick={onCreate}
          >
            <span className='knowledge-base-view__new-button-content'>
              <span className='material-symbols-rounded'>add_circle</span>
              <span>{t('knowledge.actions.new')}</span>
            </span>
          </Button>
          <Tooltip title={t('common.collapse')}>
            <Button
              className='knowledge-base-view__sidebar-control'
              type='text'
              aria-label={t('common.collapse')}
              onClick={onToggleCollapsed}
            >
              <span className='material-symbols-rounded'>left_panel_close</span>
            </Button>
          </Tooltip>
        </div>
        <Input
          className='knowledge-base-view__sidebar-search'
          prefix={<span className='material-symbols-rounded knowledge-base-view__filter-icon'>search</span>}
          placeholder={searchPlaceholder}
          allowClear
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        <div className='knowledge-base-view__nav-list'>
          {sections.map((section) => (
            <button
              key={section.key}
              type='button'
              className={`knowledge-base-view__nav-item ${section.key === activeKey ? 'is-active' : ''}`}
              onClick={() => onSelect(section.key)}
            >
              <span className='material-symbols-rounded knowledge-base-view__nav-icon'>{section.icon}</span>
              <span className='knowledge-base-view__nav-main'>
                <span className='knowledge-base-view__nav-row'>
                  <span className='knowledge-base-view__nav-label'>{section.label}</span>
                  <span className='knowledge-base-view__nav-count'>{section.count}</span>
                </span>
                <span className='knowledge-base-view__nav-desc'>{section.description}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
