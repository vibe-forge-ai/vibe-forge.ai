interface NavRailCompactMoreAction {
  active?: boolean
  icon: string
  key: string
  label: string
  onSelect: () => void
}

interface NavRailCompactChoiceAction {
  active: boolean
  icon?: string
  key: string
  label: string
  onSelect: () => void
}

export function NavRailCompactMoreSheet({
  actions,
  isOpen,
  languageActions,
  languageLabel,
  moreLabel,
  onClose,
  themeActions,
  themeLabel
}: {
  actions: NavRailCompactMoreAction[]
  isOpen: boolean
  languageActions: NavRailCompactChoiceAction[]
  languageLabel: string
  moreLabel: string
  onClose: () => void
  themeActions: NavRailCompactChoiceAction[]
  themeLabel: string
}) {
  const activeLanguageKey = languageActions.find((action) => action.active)?.key ?? languageActions[0]?.key ?? ''

  const handleActionSelect = (action: { onSelect: () => void }) => {
    action.onSelect()
    onClose()
  }

  const handleChoiceSelect = (action: NavRailCompactChoiceAction) => {
    action.onSelect()
  }

  return (
    <>
      <button
        type='button'
        className={`nav-rail-compact-sheet-backdrop ${isOpen ? 'is-open' : ''}`}
        aria-hidden={!isOpen}
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        className={`nav-rail-compact-sheet ${isOpen ? 'is-open' : ''}`}
        role='dialog'
        aria-modal={isOpen ? 'true' : undefined}
        aria-hidden={!isOpen}
        aria-label={moreLabel}
      >
        <div className='nav-rail-compact-sheet__handle' />

        {actions.length > 0 && (
          <div className='nav-rail-compact-sheet__section'>
            <div className='nav-rail-compact-sheet__section-title'>
              <span className='material-symbols-rounded nav-rail-compact-sheet__section-title-icon'>tune</span>
              <span>{moreLabel}</span>
            </div>
            <div className='nav-rail-compact-sheet__actions'>
              {actions.map((action) => (
                <button
                  key={action.key}
                  type='button'
                  className={`nav-rail-compact-sheet__action ${action.active ? 'is-active' : ''}`}
                  onClick={() => handleActionSelect(action)}
                >
                  <span className='material-symbols-rounded'>{action.icon}</span>
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className='nav-rail-compact-sheet__section'>
          <div className='nav-rail-compact-sheet__section-title'>
            <span className='material-symbols-rounded nav-rail-compact-sheet__section-title-icon'>palette</span>
            <span>{themeLabel}</span>
          </div>
          <div className='nav-rail-compact-sheet__segmented'>
            {themeActions.map((action) => (
              <button
                key={action.key}
                type='button'
                className={`nav-rail-compact-sheet__segment ${action.active ? 'is-active' : ''}`}
                onClick={() => handleChoiceSelect(action)}
              >
                {action.icon != null && (
                  <span className='material-symbols-rounded nav-rail-compact-sheet__segment-icon'>
                    {action.icon}
                  </span>
                )}
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className='nav-rail-compact-sheet__section'>
          <div className='nav-rail-compact-sheet__section-title'>
            <span className='material-symbols-rounded nav-rail-compact-sheet__section-title-icon'>language</span>
            <span>{languageLabel}</span>
          </div>
          <label className='nav-rail-compact-sheet__select-shell'>
            <span className='material-symbols-rounded nav-rail-compact-sheet__select-icon'>translate</span>
            <select
              className='nav-rail-compact-sheet__select'
              value={activeLanguageKey}
              aria-label={languageLabel}
              onChange={(event) => {
                const selectedAction = languageActions.find((action) => action.key === event.target.value)
                if (selectedAction != null) {
                  handleChoiceSelect(selectedAction)
                }
              }}
            >
              {languageActions.map((action) => (
                <option key={action.key} value={action.key}>
                  {action.label}
                </option>
              ))}
            </select>
            <span className='material-symbols-rounded nav-rail-compact-sheet__select-chevron'>expand_more</span>
          </label>
        </div>
      </div>
    </>
  )
}
