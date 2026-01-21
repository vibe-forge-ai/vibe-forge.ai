import './SidebarHeader.scss'

import { Button, Checkbox, Input, Popconfirm, Tooltip } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'

interface SidebarHeaderProps {
  onCreateSession: () => void
  onToggleCollapse: () => void
  isCollapsed?: boolean
  searchQuery: string
  onSearchChange: (query: string) => void
  isBatchMode: boolean
  onToggleBatchMode: () => void
  selectedCount: number
  totalCount: number
  onSelectAll: (selected: boolean) => void
  onBatchDelete: () => void
}

export function SidebarHeader({
  onCreateSession,
  onToggleCollapse,
  isCollapsed,
  searchQuery,
  onSearchChange,
  isBatchMode,
  onToggleBatchMode,
  selectedCount,
  totalCount,
  onSelectAll,
  onBatchDelete
}: SidebarHeaderProps) {
  const { t } = useTranslation()
  const isAllSelected = totalCount > 0 && selectedCount === totalCount

  return (
    <div className='sidebar-header'>
      <div className='header-top'>
        <Tooltip title={t('common.newChat')}>
          <Button
            className='new-chat-btn'
            type='primary'
            onClick={onCreateSession}
          >
            <span className='material-symbols-outlined'>
              add_circle
            </span>
            <span className='btn-text'>{t('common.newChat')}</span>
          </Button>
        </Tooltip>
        <Tooltip title={isCollapsed ? t('common.expand') : t('common.collapse')}>
          <Button
            className='sidebar-collapse-btn'
            type='text'
            onClick={onToggleCollapse}
          >
            <span className='material-symbols-outlined'>
              {isCollapsed ? 'menu' : 'menu_open'}
            </span>
          </Button>
        </Tooltip>
      </div>
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
            <span className='material-symbols-outlined search-icon'>
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
              <span className='material-symbols-outlined'>
                {isBatchMode ? 'close' : 'checklist'}
              </span>
            </Button>
          </Tooltip>
          {isBatchMode && (
            <Popconfirm
              title={t('common.deleteConfirm', { count: selectedCount })}
              onConfirm={onBatchDelete}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              okButtonProps={{ danger: true }}
              disabled={selectedCount === 0}
            >
              <Tooltip title={t('common.batchDelete')}>
                <Button
                  className='action-btn'
                  type='text'
                  danger
                  disabled={selectedCount === 0}
                >
                  <span className='material-symbols-outlined'>
                    delete_sweep
                  </span>
                </Button>
              </Tooltip>
            </Popconfirm>
          )}
        </div>
      </div>
    </div>
  )
}
