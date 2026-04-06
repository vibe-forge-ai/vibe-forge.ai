import { Button, Checkbox, Popconfirm, Tooltip } from 'antd'
import { useTranslation } from 'react-i18next'

interface SidebarHeaderBatchActionsProps {
  isAllSelected: boolean
  selectedCount: number
  totalCount: number
  onBatchArchive: () => void
  onBatchDelete: () => void
  onBatchStar: () => void
  onSelectAll: (selected: boolean) => void
}

export function SidebarHeaderBatchActions({
  isAllSelected,
  selectedCount,
  totalCount,
  onBatchArchive,
  onBatchDelete,
  onBatchStar,
  onSelectAll
}: SidebarHeaderBatchActionsProps) {
  const { t } = useTranslation()

  return (
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
  )
}
