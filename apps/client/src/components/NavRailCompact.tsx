import { Button } from 'antd'
import { useEffect, useState } from 'react'

import { NavRailCompactMoreSheet } from './NavRailCompactMoreSheet'

export interface NavRailCompactItem {
  active: boolean
  icon: string
  key: string
  label: string
  path: string
}

export interface NavRailCompactMoreAction {
  active?: boolean
  icon: string
  key: string
  label: string
  onSelect: () => void
}

export interface NavRailCompactChoiceAction {
  active: boolean
  icon?: string
  key: string
  label: string
  onSelect: () => void
}

export function NavRailCompact({
  ariaHidden = false,
  currentPath,
  languageActions,
  languageLabel,
  moreLabel,
  moreSheetActions,
  navItems,
  themeActions,
  themeLabel,
  onNavClick
}: {
  ariaHidden?: boolean
  currentPath: string
  languageActions: NavRailCompactChoiceAction[]
  languageLabel: string
  moreLabel: string
  moreSheetActions: NavRailCompactMoreAction[]
  navItems: NavRailCompactItem[]
  themeActions: NavRailCompactChoiceAction[]
  themeLabel: string
  onNavClick: (key: string, path: string) => void
}) {
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false)

  useEffect(() => {
    setIsMoreSheetOpen(false)
  }, [currentPath])

  useEffect(() => {
    if (ariaHidden) {
      setIsMoreSheetOpen(false)
    }
  }, [ariaHidden])

  return (
    <div className='nav-rail nav-rail--compact' aria-hidden={ariaHidden || undefined}>
      <div className='nav-rail-compact-list'>
        {navItems.map((item) => (
          <Button
            key={item.key}
            type='text'
            className={`nav-item nav-item--compact ${item.active ? 'active' : ''}`}
            data-ai-ui-anchor={`navigation.${item.key === 'sessions' ? 'chat' : item.key}`}
            title={item.label}
            aria-label={item.label}
            onClick={() => {
              setIsMoreSheetOpen(false)
              onNavClick(item.key, item.path)
            }}
            icon={<span className='material-symbols-rounded'>{item.icon}</span>}
          />
        ))}

        <Button
          type='text'
          className={`nav-item nav-item--compact ${isMoreSheetOpen || currentPath === '/config' ? 'active' : ''}`}
          data-ai-ui-anchor='navigation.more'
          title={moreLabel}
          aria-expanded={isMoreSheetOpen}
          aria-haspopup='dialog'
          aria-label={moreLabel}
          onClick={() => setIsMoreSheetOpen((prev) => !prev)}
          icon={<span className='material-symbols-rounded'>more_horiz</span>}
        />
      </div>

      <NavRailCompactMoreSheet
        actions={moreSheetActions}
        isOpen={isMoreSheetOpen}
        languageActions={languageActions}
        languageLabel={languageLabel}
        moreLabel={moreLabel}
        onClose={() => setIsMoreSheetOpen(false)}
        themeActions={themeActions}
        themeLabel={themeLabel}
      />
    </div>
  )
}
