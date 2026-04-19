import './NavRail.scss'

import { Button, Dropdown, Tooltip } from 'antd'
import type { MenuProps } from 'antd'
import { useAtom } from 'jotai'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

import { useResponsiveLayout } from '#~/hooks/use-responsive-layout'
import { themeAtom } from '../store'
import { NavRailCompact } from './NavRailCompact'
import { useNavRailAccountActions } from './nav-rail-account-actions'
import {
  buildCompactLanguageActions,
  buildCompactMoreActions,
  buildCompactThemeActions
} from './nav-rail-compact-config'
import { buildLanguageItems, buildNavItems, buildThemeItems } from './nav-rail-items'

export function NavRail({
  ariaHidden = false,
  isCompactLayout = false,
  onOpenSidebar,
  showSidebar = false
}: {
  ariaHidden?: boolean
  isCompactLayout?: boolean
  onOpenSidebar?: () => void
  showSidebar?: boolean
}) {
  const { t, i18n } = useTranslation()
  const [themeMode, setThemeMode] = useAtom(themeAtom)
  const navigate = useNavigate()
  const location = useLocation()
  const { isTouchInteraction } = useResponsiveLayout()
  const { accountItems, accountMenuLabel, compactAccountActions, showAccountMenu } = useNavRailAccountActions()

  const currentPath = location.pathname
  const resolveTooltipTitle = (title: string) => isTouchInteraction ? undefined : title

  const langItems: MenuProps['items'] = React.useMemo(() =>
    buildLanguageItems({
      currentLanguage: i18n.language,
      onChangeLanguage: (language) => i18n.changeLanguage(language)
    }), [i18n.language])

  const themeItems: MenuProps['items'] = React.useMemo(() =>
    buildThemeItems({
      setThemeMode,
      t,
      themeMode
    }), [setThemeMode, t, themeMode])

  const navItems = React.useMemo(() => buildNavItems({ currentPath, t }), [currentPath, t])

  const compactMoreActions = React.useMemo(() => [
    ...buildCompactMoreActions({
      currentPath,
      navigate,
      onOpenSidebar,
      showSidebar,
      t
    }),
    ...compactAccountActions
  ], [
    compactAccountActions,
    currentPath,
    navigate,
    onOpenSidebar,
    showSidebar,
    t
  ])

  const compactThemeActions = React.useMemo(() =>
    buildCompactThemeActions({
      setThemeMode,
      t,
      themeMode
    }), [setThemeMode, t, themeMode])

  const compactLanguageActions = React.useMemo(() =>
    buildCompactLanguageActions({
      currentLanguage: i18n.language,
      onChangeLanguage: (language) => {
        void i18n.changeLanguage(language)
      }
    }), [i18n.language])

  const handleNavClick = (_key: string, path: string) => {
    void navigate(path)
  }

  if (isCompactLayout) {
    return (
      <NavRailCompact
        ariaHidden={ariaHidden}
        currentPath={currentPath}
        languageActions={compactLanguageActions}
        languageLabel={t('common.language')}
        moreLabel={t('common.moreActions')}
        moreSheetActions={compactMoreActions}
        navItems={navItems}
        themeActions={compactThemeActions}
        themeLabel={t('common.theme')}
        onNavClick={handleNavClick}
      />
    )
  }

  return (
    <div className='nav-rail' aria-hidden={ariaHidden || undefined}>
      <div className='nav-rail-top'>
        {navItems.map(item => (
          <Tooltip key={item.key} title={resolveTooltipTitle(item.label)} placement='right'>
            <span>
              <Button
                type='text'
                className={`nav-item ${item.active ? 'active' : ''}`}
                onClick={() => handleNavClick(item.key, item.path)}
                icon={<span className='material-symbols-rounded'>{item.icon}</span>}
              />
            </span>
          </Tooltip>
        ))}
      </div>
      <div className='nav-rail-bottom'>
        <Tooltip title={resolveTooltipTitle(t('common.theme'))} placement='right'>
          <span>
            <Dropdown
              menu={{
                items: themeItems
              }}
              placement='topRight'
              trigger={['click']}
            >
              <Button
                type='text'
                className='nav-item'
                icon={
                  <span className='material-symbols-rounded'>
                    {themeMode === 'light' ? 'light_mode' : themeMode === 'dark' ? 'dark_mode' : 'desktop_windows'}
                  </span>
                }
              />
            </Dropdown>
          </span>
        </Tooltip>
        <Tooltip title={resolveTooltipTitle(t('common.language'))} placement='right'>
          <span>
            <Dropdown
              menu={{
                items: langItems
              }}
              placement='topRight'
              trigger={['click']}
            >
              <Button
                type='text'
                className='nav-item'
                icon={<span className='material-symbols-rounded'>language</span>}
              />
            </Dropdown>
          </span>
        </Tooltip>
        {showAccountMenu && (
          <Tooltip title={resolveTooltipTitle(accountMenuLabel)} placement='right'>
            <span>
              <Dropdown
                menu={{
                  items: accountItems
                }}
                placement='topRight'
                trigger={['click']}
              >
                <Button
                  type='text'
                  className='nav-item'
                  icon={<span className='material-symbols-rounded'>account_circle</span>}
                />
              </Dropdown>
            </span>
          </Tooltip>
        )}
        <Tooltip title={resolveTooltipTitle(t('common.settings'))} placement='right'>
          <span>
            <Button
              type='text'
              className={`nav-item ${currentPath === '/config' ? 'active' : ''}`}
              icon={<span className='material-symbols-rounded'>settings</span>}
              onClick={() => void navigate('/config')}
            />
          </span>
        </Tooltip>
      </div>
    </div>
  )
}
