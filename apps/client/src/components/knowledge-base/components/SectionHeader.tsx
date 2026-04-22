import './SectionHeader.scss'

import type { ReactNode } from 'react'

interface SectionHeaderProps {
  actions?: ReactNode
  leading?: ReactNode
}

export function SectionHeader({ actions, leading }: SectionHeaderProps) {
  if (actions == null && leading == null) return null

  return (
    <div className='knowledge-base-view__section-header'>
      <div className='knowledge-base-view__section-leading'>{leading}</div>
      <div className='knowledge-base-view__section-actions'>{actions}</div>
    </div>
  )
}
