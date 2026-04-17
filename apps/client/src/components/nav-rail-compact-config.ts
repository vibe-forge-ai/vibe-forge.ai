import type { TFunction } from 'i18next'
import type { NavigateFunction } from 'react-router-dom'

import type { ThemeMode } from '#~/store'

import type { NavRailCompactChoiceAction, NavRailCompactMoreAction } from './NavRailCompact'

export function buildCompactMoreActions({
  currentPath,
  navigate,
  onOpenSidebar,
  showSidebar,
  t
}: {
  currentPath: string
  navigate: NavigateFunction
  onOpenSidebar?: () => void
  showSidebar: boolean
  t: TFunction
}): NavRailCompactMoreAction[] {
  const actions: NavRailCompactMoreAction[] = []

  if (showSidebar && onOpenSidebar != null) {
    actions.push({
      active: currentPath === '/' || currentPath.startsWith('/session/'),
      icon: 'menu',
      key: 'sessions',
      label: t('common.sessions'),
      onSelect: onOpenSidebar
    })
  }

  actions.push({
    active: currentPath === '/config',
    icon: 'settings',
    key: 'settings',
    label: t('common.settings'),
    onSelect: () => {
      void navigate('/config')
    }
  })

  return actions
}

export function buildCompactThemeActions({
  setThemeMode,
  t,
  themeMode
}: {
  setThemeMode: (value: ThemeMode) => void
  t: TFunction
  themeMode: ThemeMode
}): NavRailCompactChoiceAction[] {
  return [
    {
      active: themeMode === 'light',
      icon: 'light_mode',
      key: 'light',
      label: t('common.themeLight'),
      onSelect: () => {
        setThemeMode('light')
        localStorage.setItem('theme', 'light')
      }
    },
    {
      active: themeMode === 'dark',
      icon: 'dark_mode',
      key: 'dark',
      label: t('common.themeDark'),
      onSelect: () => {
        setThemeMode('dark')
        localStorage.setItem('theme', 'dark')
      }
    },
    {
      active: themeMode === 'system',
      icon: 'desktop_windows',
      key: 'system',
      label: t('common.themeSystem'),
      onSelect: () => {
        setThemeMode('system')
        localStorage.setItem('theme', 'system')
      }
    }
  ]
}

export function buildCompactLanguageActions({
  currentLanguage,
  onChangeLanguage
}: {
  currentLanguage: string
  onChangeLanguage: (language: string) => void
}): NavRailCompactChoiceAction[] {
  return [
    {
      active: currentLanguage.startsWith('zh'),
      key: 'zh',
      label: '简体中文',
      onSelect: () => {
        onChangeLanguage('zh')
      }
    },
    {
      active: currentLanguage.startsWith('en'),
      key: 'en',
      label: 'English',
      onSelect: () => {
        onChangeLanguage('en')
      }
    }
  ]
}
