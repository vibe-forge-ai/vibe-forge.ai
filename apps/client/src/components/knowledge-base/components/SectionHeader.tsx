import './SectionHeader.scss'

import type { ReactNode } from 'react'

interface SectionHeaderProps {
  actions?: ReactNode
}

export function SectionHeader({ actions }: SectionHeaderProps) {
  if (actions == null) return null

  return (
    <div className='knowledge-base-view__section-header'>
      {actions}
    </div>
  )
}
