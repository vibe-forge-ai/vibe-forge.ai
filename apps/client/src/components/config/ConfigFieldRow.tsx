import './ConfigFieldRow.scss'

import type { ReactNode } from 'react'

export const FieldRow = ({
  title,
  description,
  icon,
  layout = 'inline',
  children
}: {
  title: string
  description?: string
  icon?: string
  layout?: 'inline' | 'stacked'
  children: ReactNode
}) => (
  <div className={`config-view__field-row${layout === 'stacked' ? ' config-view__field-row--stacked' : ''}`}>
    <div className='config-view__field-meta'>
      {icon != null && (
        <span className='material-symbols-rounded config-view__field-icon'>
          {icon}
        </span>
      )}
      <div className='config-view__field-text'>
        <div className='config-view__field-title'>{title}</div>
        {description != null && description !== '' && (
          <div className='config-view__field-desc'>{description}</div>
        )}
      </div>
    </div>
    <div className='config-view__field-control'>
      {children}
    </div>
  </div>
)
