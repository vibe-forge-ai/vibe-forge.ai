import './SectionHeader.scss'

import type { ReactNode } from 'react'

type SectionHeaderProps = {
  title: string
  description: string
  actions?: ReactNode
}

export function SectionHeader({ title, description, actions }: SectionHeaderProps) {
  return (
    <div className='knowledge-base-view__section-header'>
      <div className='knowledge-base-view__section-info'>
        <div className='knowledge-base-view__section-title'>{title}</div>
        <div className='knowledge-base-view__section-desc'>{description}</div>
      </div>
      {actions}
    </div>
  )
}
