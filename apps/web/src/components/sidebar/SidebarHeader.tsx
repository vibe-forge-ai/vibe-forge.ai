import './SidebarHeader.scss'

import { Button, Checkbox, Input, Popconfirm, Tooltip } from 'antd'
import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface SidebarHeaderProps {
  onToggleCollapse: () => void
  isCollapsed?: boolean
  searchQuery: string
  onSearchChange: (query: string) => void
  isBatchMode: boolean
  onToggleBatchMode: () => void
  selectedCount: number
  totalCount: number
  onSelectAll: (selected: boolean) => void
  onBatchArchive: () => void
  isCreatingSession: boolean
  onCreateSession: () => void
}

export function SidebarHeader({
  onToggleCollapse,
  isCollapsed,
  searchQuery,
  onSearchChange,
  isBatchMode,
  onToggleBatchMode,
  selectedCount,
  totalCount,
  onSelectAll,
  onBatchArchive,
  isCreatingSession,
  onCreateSession
}: SidebarHeaderProps) {
  const { t } = useTranslation()
  const isAllSelected = totalCount > 0 && selectedCount === totalCount

  return (
    <div className='sidebar-header'>
      <div className='header-bottom'>
        {isBatchMode && (
          <div className='batch-select-wrapper'>
            <Tooltip title={isAllSelected ? t('common.deselectAll') : t('common.selectAll')}>
              <Checkbox
                checked={isAllSelected}
                indeterminate={selectedCount > 0 && selectedCount < totalCount}
                onChange={(e) => onSelectAll(e.target.checked)}
              />
            </Tooltip>
          </div>
        )}
        <Input
          className='search-input'
          placeholder={t('common.search')}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          prefix={
            <span className='material-symbols-rounded search-icon'>
              search
            </span>
          }
          allowClear
        />
        <div className='batch-actions'>
          <Tooltip title={isBatchMode ? t('common.cancelBatch') : t('common.batchMode')}>
            <Button
              className={`action-btn ${isBatchMode ? 'active' : ''}`}
              type={isBatchMode ? 'primary' : 'text'}
              onClick={onToggleBatchMode}
            >
              <span className='material-symbols-rounded'>
                {isBatchMode ? 'close' : 'checklist'}
              </span>
            </Button>
          </Tooltip>
          {isBatchMode && (
            <Popconfirm
              title={t('common.archiveConfirm', { count: selectedCount })}
              onConfirm={onBatchArchive}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              okButtonProps={{ danger: false }}
              disabled={selectedCount === 0}
            >
              <Tooltip title={t('common.batchArchive')}>
                <Button
                  className='action-btn'
                  type='text'
                  disabled={selectedCount === 0}
                >
                  <span className='material-symbols-rounded'>
                    archive
                  </span>
                </Button>
              </Tooltip>
            </Popconfirm>
          )}
        </div>
        <Tooltip title={isCollapsed ? t('common.expand') : t('common.collapse')}>
          <Button
            className='sidebar-collapse-btn'
            type='text'
            onClick={onToggleCollapse}
          >
            <span className='material-symbols-rounded'>
              {isCollapsed ? 'dock_to_right' : 'left_panel_close'}
            </span>
          </Button>
        </Tooltip>
        {isCollapsed && (
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
      </div>
    </div>
  )
}
