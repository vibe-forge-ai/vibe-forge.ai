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
    <div
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        flexShrink: 0
      }}
    >
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <Tooltip title={t('common.newChat')}>
          <Button
            type='primary'
            onClick={onCreateSession}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '32px',
              padding: 0
            }}
          >
            <span
              className='material-symbols-outlined'
              style={{ fontSize: 18, display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}
            >
              add_circle
            </span>
            <span style={{ marginLeft: '8px', fontSize: '14px' }}>{t('common.newChat')}</span>
          </Button>
        </Tooltip>
        <Tooltip title={isCollapsed ? t('common.expand') : t('common.collapse')}>
          <Button
            className='sidebar-collapse-btn'
            type='text'
            onClick={onToggleCollapse}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              padding: 0,
              color: '#6b7280'
            }}
          >
            <span className='material-symbols-outlined' style={{ fontSize: 20 }}>
              {isCollapsed ? 'menu' : 'menu_open'}
            </span>
          </Button>
        </Tooltip>
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {isBatchMode && (
          <div
            style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
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
          placeholder={t('common.search')}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          prefix={
            <span
              className='material-symbols-outlined'
              style={{ fontSize: 18, color: '#9ca3af', display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}
            >
              search
            </span>
          }
          allowClear
          style={{ borderRadius: '6px', flex: 1 }}
        />
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Tooltip title={isBatchMode ? t('common.cancelBatch') : t('common.batchMode')}>
            <Button
              type={isBatchMode ? 'primary' : 'text'}
              onClick={onToggleBatchMode}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                padding: 0,
                color: isBatchMode ? undefined : '#6b7280',
                flexShrink: 0
              }}
            >
              <span
                className='material-symbols-outlined'
                style={{ fontSize: 20, display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}
              >
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
                  type='text'
                  danger
                  disabled={selectedCount === 0}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    padding: 0,
                    flexShrink: 0
                  }}
                >
                  <span
                    className='material-symbols-outlined'
                    style={{ fontSize: 20, display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}
                  >
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
