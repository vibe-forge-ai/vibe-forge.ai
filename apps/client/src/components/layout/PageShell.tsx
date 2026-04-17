import './PageShell.scss'

import type { PropsWithChildren, ReactNode } from 'react'

type PageShellProps = PropsWithChildren<{
  bodyClassName?: string
  className?: string
  header?: ReactNode
}>

export function PageShell({
  bodyClassName,
  children,
  className,
  header
}: PageShellProps) {
  const rootClassName = ['page-shell', className].filter(Boolean).join(' ')
  const bodyClasses = ['page-shell__body', bodyClassName].filter(Boolean).join(' ')

  return (
    <div className={rootClassName}>
      {header != null && (
        <div className='page-shell__header'>
          {header}
        </div>
      )}
      <div className={bodyClasses}>
        {children}
      </div>
    </div>
  )
}
