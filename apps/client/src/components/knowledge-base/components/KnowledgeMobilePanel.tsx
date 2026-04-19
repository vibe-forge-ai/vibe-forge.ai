import { Button, Input, Tooltip } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'

import type { KnowledgeSectionNavItem } from './KnowledgeSidebar'

interface KnowledgeMobilePanelProps {
  activeKey: string
  open: boolean
  searchPlaceholder: string
  searchValue: string
  sections: KnowledgeSectionNavItem[]
  showSearch: boolean
  onClose: () => void
  onCreate: () => void
  onSearchChange: (value: string) => void
  onSelect: (key: string) => void
}

export function KnowledgeMobilePanel({
  activeKey,
  open,
  searchPlaceholder,
  searchValue,
  sections,
  showSearch,
  onClose,
  onCreate,
  onSearchChange,
  onSelect
}: KnowledgeMobilePanelProps) {
  const { t } = useTranslation()

  React.useEffect(() => {
    if (!open) return undefined

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  return (
    <>
      <button
        type='button'
        className={`knowledge-base-view__mobile-sidebar-backdrop ${open ? 'is-open' : ''}`}
        aria-label={t('common.close')}
        aria-hidden={!open}
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        className={`knowledge-base-view__mobile-sidebar-sheet ${open ? 'is-open' : ''}`}
        role='dialog'
        aria-modal={open ? 'true' : undefined}
        aria-label={t('knowledge.title')}
        aria-hidden={!open}
        tabIndex={-1}
      >
        <div className='knowledge-base-view__mobile-sidebar'>
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
            <Tooltip title={t('common.close')}>
              <Button
                className='knowledge-base-view__sidebar-control'
                type='text'
                aria-label={t('common.close')}
                onClick={onClose}
              >
                <span className='material-symbols-rounded'>close</span>
              </Button>
            </Tooltip>
          </div>
          {showSearch && (
            <Input
              className='knowledge-base-view__sidebar-search'
              prefix={<span className='material-symbols-rounded knowledge-base-view__filter-icon'>search</span>}
              placeholder={searchPlaceholder}
              allowClear
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          )}
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
    </>
  )
}
