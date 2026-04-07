export interface MessageContextMenuEntry {
  confirmLabel?: string
  danger?: boolean
  icon: string
  key: string
  label: string
  onClick: () => void
  type?: 'divider'
}

export function MessageContextMenuContent({
  entries,
  pendingAction,
  onCancelConfirm
}: {
  entries: MessageContextMenuEntry[]
  pendingAction: string | null
  onCancelConfirm: () => void
}) {
  return (
    <div className='message-context-menu' onContextMenu={(event) => event.preventDefault()}>
      {entries.map((entry) => {
        if (entry.type === 'divider') {
          return <div key={entry.key} className='message-context-menu__divider' />
        }

        const isConfirming = pendingAction === entry.key
        return (
          <div
            key={entry.key}
            role='button'
            tabIndex={0}
            className={`message-context-menu__item message-context-menu__item--${entry.key} ${
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
            <div className='message-context-menu__meta'>
              <span className='material-symbols-rounded message-context-menu__icon'>
                {entry.icon}
              </span>
              <span className='message-context-menu__label'>
                {isConfirming ? (entry.confirmLabel ?? entry.label) : entry.label}
              </span>
            </div>
            {isConfirming && (
              <div className='message-context-menu__confirm-actions'>
                <button
                  type='button'
                  className='message-context-menu__confirm-btn is-accept'
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
                  className='message-context-menu__confirm-btn is-cancel'
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
