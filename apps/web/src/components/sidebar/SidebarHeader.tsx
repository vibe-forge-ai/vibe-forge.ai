import { Button, Input, Popconfirm } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'

interface SidebarHeaderProps {
  onCreateSession: () => void
  onToggleCollapse: () => void
  searchQuery: string
  onSearchChange: (query: string) => void
  isBatchMode: boolean
  onToggleBatchMode: () => void
  selectedCount: number
  onBatchDelete: () => void
}

export function SidebarHeader({
  onCreateSession,
  onToggleCollapse,
  searchQuery,
  onSearchChange,
  isBatchMode,
  onToggleBatchMode,
  selectedCount,
  onBatchDelete
}: SidebarHeaderProps) {
  const { t } = useTranslation()
  return (
    <div
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        flexShrink: 0
      }}
    >
      <div style={{ display: 'flex', gap: '8px' }}>
        <Button
          type='primary'
          onClick={onCreateSession}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
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
          <span style={{ lineHeight: 1 }}>{t('common.newChat')}</span>
        </Button>
        <Button
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
          title={t('common.collapse')}
        >
          <span
            className='material-symbols-outlined'
            style={{ fontSize: 20, display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}
          >
            keyboard_double_arrow_left
          </span>
        </Button>
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
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
            title={isBatchMode ? t('common.cancelBatch') : t('common.batchMode')}
          >
            <span
              className='material-symbols-outlined'
              style={{ fontSize: 20, display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}
            >
              {isBatchMode ? 'close' : 'checklist'}
            </span>
          </Button>
          {isBatchMode && (
            <Popconfirm
              title={t('common.deleteConfirm', { count: selectedCount })}
              onConfirm={onBatchDelete}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              okButtonProps={{ danger: true }}
              disabled={selectedCount === 0}
            >
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
                title={t('common.batchDelete')}
              >
                <span
                  className='material-symbols-outlined'
                  style={{ fontSize: 20, display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}
                >
                  delete_sweep
                </span>
              </Button>
            </Popconfirm>
          )}
        </div>
      </div>
    </div>
  )
}
