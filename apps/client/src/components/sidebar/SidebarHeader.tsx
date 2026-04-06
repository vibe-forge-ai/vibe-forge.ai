import './SidebarHeader.scss'

import { Button, Tooltip } from 'antd'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { SidebarSessionSortOrder } from '#~/hooks/use-sidebar-query-state'
import { SidebarHeaderSearchActions } from './SidebarHeaderSearchActions'

interface SidebarHeaderProps {
  adapterFilters: string[]
  availableAdapters: string[]
  availableTags: string[]
  createButtonRef: React.RefObject<HTMLButtonElement | null>
  hasActiveSearchControls: boolean
  isBatchMode: boolean
  isCreatingSession: boolean
  isSidebarCollapsed: boolean
  searchQuery: string
  selectedCount: number
  sortOrder: SidebarSessionSortOrder
  sortSelection?: SidebarSessionSortOrder
  shortcutLabel: string
  tagFilters: string[]
  totalCount: number
  onBatchArchive: () => void
  onBatchDelete: () => void
  onBatchStar: () => void
  onAdapterFilterChange: (filters: string[]) => void
  onCreateSession: () => void
  onSearchChange: (query: string) => void
  onSortOrderChange: (sort?: SidebarSessionSortOrder) => void
  onSelectAll: (selected: boolean) => void
  onTagFilterChange: (tags: string[]) => void
  onToggleBatchMode: () => void
  onToggleSidebarCollapsed: () => void
}

export function SidebarHeader({
  adapterFilters,
  availableAdapters,
  availableTags,
  createButtonRef,
  hasActiveSearchControls,
  isBatchMode,
  isCreatingSession,
  isSidebarCollapsed,
  searchQuery,
  selectedCount,
  sortOrder,
  sortSelection,
  shortcutLabel,
  tagFilters,
  totalCount,
  onBatchArchive,
  onBatchDelete,
  onBatchStar,
  onAdapterFilterChange,
  onCreateSession,
  onSearchChange,
  onSortOrderChange,
  onSelectAll,
  onTagFilterChange,
  onToggleBatchMode,
  onToggleSidebarCollapsed
}: SidebarHeaderProps) {
  const { t } = useTranslation()
  const [isSearchActionsOpen, setIsSearchActionsOpen] = useState(false)
  const shouldShowSearchActions = !isSidebarCollapsed && (isSearchActionsOpen || isBatchMode)

  return (
    <div className='sidebar-header'>
      <div className='header-top'>
        {!isSidebarCollapsed
          ? (
            <Button
              ref={createButtonRef}
              className={`new-chat-btn ${isCreatingSession ? 'active' : ''}`}
              type={isCreatingSession ? 'default' : 'primary'}
              block
              disabled={!!isCreatingSession}
              onClick={onCreateSession}
            >
              <span className='btn-content'>
                <span className={`material-symbols-rounded ${isCreatingSession ? 'filled' : ''}`}>
                  {isCreatingSession ? 'chat_bubble' : 'send'}
                </span>
                <span>{isCreatingSession ? t('common.creatingChat') : t('common.newChat')}</span>
              </span>
              <span className='shortcut-tag'>
                {shortcutLabel}
              </span>
            </Button>
          )
          : (
            <Tooltip title={isCreatingSession ? t('common.alreadyInNewChat') : t('common.newChat')} placement='right'>
              <Button
                className={`sidebar-new-chat-btn ${isCreatingSession ? 'active' : ''}`}
                type='text'
                disabled={!!isCreatingSession}
                onClick={onCreateSession}
              >
                <span className={`material-symbols-rounded ${isCreatingSession ? 'filled' : ''}`}>
                  {isCreatingSession ? 'chat_bubble' : 'send'}
                </span>
              </Button>
            </Tooltip>
          )}
        <Tooltip title={isSidebarCollapsed ? t('common.expand') : t('common.collapse')}>
          <Button
            className='sidebar-collapse-btn'
            type='text'
            onClick={onToggleSidebarCollapsed}
          >
            <span className='material-symbols-rounded'>
              {isSidebarCollapsed ? 'dock_to_right' : 'left_panel_close'}
            </span>
          </Button>
        </Tooltip>
      </div>

      {!isSidebarCollapsed && (
        <SidebarHeaderSearchActions
          adapterFilters={adapterFilters}
          availableAdapters={availableAdapters}
          availableTags={availableTags}
          hasActiveSearchControls={hasActiveSearchControls}
          isBatchMode={isBatchMode}
          searchQuery={searchQuery}
          selectedCount={selectedCount}
          shouldShowSearchActions={shouldShowSearchActions}
          sortOrder={sortOrder}
          sortSelection={sortSelection}
          tagFilters={tagFilters}
          totalCount={totalCount}
          onBatchArchive={onBatchArchive}
          onBatchDelete={onBatchDelete}
          onBatchStar={onBatchStar}
          onAdapterFilterChange={onAdapterFilterChange}
          onSearchChange={onSearchChange}
          onSortOrderChange={onSortOrderChange}
          onSelectAll={onSelectAll}
          onTagFilterChange={onTagFilterChange}
          onToggleBatchMode={onToggleBatchMode}
          onToggleSearchActions={() => setIsSearchActionsOpen((prev) => !prev)}
        />
      )}
    </div>
  )
}
