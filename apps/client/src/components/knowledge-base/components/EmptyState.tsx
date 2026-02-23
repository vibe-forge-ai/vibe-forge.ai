import './EmptyState.scss'

import { Empty } from 'antd'

import { ActionButton } from './ActionButton'

type EmptyStateProps = {
  description: string
  actionLabel?: string
  onAction?: () => void
  variant?: 'default' | 'simple'
}

export function EmptyState({
  description,
  actionLabel,
  onAction,
  variant = 'default'
}: EmptyStateProps) {
  if (variant === 'simple') {
    return (
      <div className='knowledge-base-view__empty-simple'>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description} />
      </div>
    )
  }

  return (
    <div className='knowledge-base-view__empty'>
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description} />
      {actionLabel && onAction && (
        <ActionButton
          type='primary'
          icon={<span className='material-symbols-rounded'>add_circle</span>}
          onClick={onAction}
        >
          {actionLabel}
        </ActionButton>
      )}
    </div>
  )
}
