import './TabContent.scss'

import type { ReactNode } from 'react'

type TabContentProps = {
  children: ReactNode
  className?: string
}

export function TabContent({ children, className }: TabContentProps) {
  const mergedClassName = ['knowledge-base-view__content', className].filter(Boolean).join(' ')
  return (
    <div className={mergedClassName}>
      {children}
    </div>
  )
}
