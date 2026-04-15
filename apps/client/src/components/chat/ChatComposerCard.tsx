import './ChatComposerCard.scss'

import type { ReactNode } from 'react'

export function ChatComposerCard({
  className,
  summary,
  summaryClassName,
  bodyClassName,
  progress,
  children,
  expanded = true,
  onToggle,
  narrow = false
}: {
  className?: string
  summary: ReactNode
  summaryClassName?: string
  bodyClassName?: string
  progress?: ReactNode
  children?: ReactNode
  expanded?: boolean
  onToggle?: () => void
  narrow?: boolean
}) {
  const classes = [
    'chat-composer-card',
    narrow ? 'chat-composer-card--narrow' : '',
    expanded ? 'is-expanded' : 'is-collapsed',
    className ?? ''
  ].filter(Boolean).join(' ')
  const summaryClasses = ['chat-composer-card__summary', summaryClassName ?? ''].filter(Boolean).join(' ')
  const bodyClasses = ['chat-composer-card__body', bodyClassName ?? ''].filter(Boolean).join(' ')
  const hasBody = children != null

  return (
    <section className={classes}>
      {onToggle != null
        ? (
          <button type='button' className={summaryClasses} onClick={onToggle}>
            {summary}
          </button>
        )
        : (
          <div className={summaryClasses}>
            {summary}
          </div>
        )}
      {progress}
      {hasBody && (
        <div className='chat-composer-card__content' aria-hidden={!expanded}>
          <div className={bodyClasses}>
            {children}
          </div>
        </div>
      )}
    </section>
  )
}
