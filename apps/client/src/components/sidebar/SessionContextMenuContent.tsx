interface SessionContextMenuEntry {
  confirmLabel?: string
  danger?: boolean
  icon: string
  key: string
  label: string
  onClick: () => void
  type?: 'divider'
}

export function SessionContextMenuContent({
  entries,
  pendingAction,
  onCancelConfirm
}: {
  entries: SessionContextMenuEntry[]
  pendingAction: string | null
  onCancelConfirm: () => void
}) {
  return (
    <div className='session-context-menu' onContextMenu={(event) => event.preventDefault()}>
      {entries.map((entry) => {
        if (entry.type === 'divider') {
          return <div key={entry.key} className='session-context-menu__divider' />
        }

        const isConfirming = pendingAction === entry.key
        return (
          <div
            key={entry.key}
            role='button'
            tabIndex={0}
            className={`session-context-menu__item session-context-menu__item--${entry.key} ${
              entry.danger ? 'is-danger' : ''
            } ${isConfirming ? 'is-confirming' : ''}`}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              entry.onClick()
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                entry.onClick()
              }
            }}
          >
            <div className='session-context-menu__meta'>
              <span className='material-symbols-rounded session-context-menu__icon'>
                {entry.icon}
              </span>
              <span className='session-context-menu__label'>
                {isConfirming ? (entry.confirmLabel ?? entry.label) : entry.label}
              </span>
            </div>
            {isConfirming && (
              <div className='session-context-menu__confirm-actions'>
                <button
                  type='button'
                  className='session-context-menu__confirm-btn is-accept'
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    entry.onClick()
                  }}
                >
                  <span className='material-symbols-rounded'>check</span>
                </button>
                <button
                  type='button'
                  className='session-context-menu__confirm-btn is-cancel'
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    onCancelConfirm()
                  }}
                >
                  <span className='material-symbols-rounded'>close</span>
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export type { SessionContextMenuEntry }
