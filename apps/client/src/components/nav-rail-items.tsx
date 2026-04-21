import type { MenuProps } from 'antd'
import type { TFunction } from 'i18next'
import type { NavigateFunction } from 'react-router-dom'

import type { ThemeMode } from '#~/store'

export interface NavRailItem {
  active: boolean
  icon: string
  key: string
  label: string
  path: string
}

export function buildLanguageItems({
  currentLanguage,
  onChangeLanguage
}: {
  currentLanguage: string
  onChangeLanguage: (language: string) => unknown
}): MenuProps['items'] {
  return [
    {
      key: 'zh',
      label: '简体中文',
      icon: currentLanguage.startsWith('zh')
        ? (
          <span className='material-symbols-rounded nav-menu-icon active'>check</span>
        )
        : <div className='nav-menu-icon-placeholder' />,
      onClick: () => {
        void onChangeLanguage('zh')
      }
    },
    {
      key: 'en',
      label: 'English',
      icon: currentLanguage.startsWith('en')
        ? (
          <span className='material-symbols-rounded nav-menu-icon active'>check</span>
        )
        : <div className='nav-menu-icon-placeholder' />,
      onClick: () => {
        void onChangeLanguage('en')
      }
    }
  ]
}

export function buildThemeItems({
  setThemeMode,
  t,
  themeMode
}: {
  setThemeMode: (themeMode: ThemeMode) => void
  t: TFunction
  themeMode: ThemeMode
}): MenuProps['items'] {
  return [
    {
      key: 'light',
      label: t('common.themeLight'),
      icon: themeMode === 'light'
        ? <span className='material-symbols-rounded nav-menu-icon active'>check</span>
        : <span className='material-symbols-rounded nav-menu-icon'>light_mode</span>,
      onClick: () => {
        setThemeMode('light')
        localStorage.setItem('theme', 'light')
      }
    },
    {
      key: 'dark',
      label: t('common.themeDark'),
      icon: themeMode === 'dark'
        ? <span className='material-symbols-rounded nav-menu-icon active'>check</span>
        : <span className='material-symbols-rounded nav-menu-icon'>dark_mode</span>,
      onClick: () => {
        setThemeMode('dark')
        localStorage.setItem('theme', 'dark')
      }
    },
    {
      key: 'system',
      label: t('common.themeSystem'),
      icon: themeMode === 'system'
        ? <span className='material-symbols-rounded nav-menu-icon active'>check</span>
        : <span className='material-symbols-rounded nav-menu-icon'>desktop_windows</span>,
      onClick: () => {
        setThemeMode('system')
        localStorage.setItem('theme', 'system')
      }
    }
  ]
}

export function buildNavItems({
  currentPath,
  t
}: {
  currentPath: string
  t: TFunction
}): NavRailItem[] {
  return [
    {
      key: 'sessions',
      icon: 'chat_bubble',
      label: t('common.sessions'),
      path: '/',
      active: currentPath === '/' || currentPath.startsWith('/session/')
    },
    {
      key: 'knowledge',
      icon: 'library_books',
      label: t('common.knowledgeBase'),
      path: '/knowledge',
      active: currentPath === '/knowledge'
    },
    {
      key: 'automation',
      icon: 'schedule',
      label: t('common.automation'),
      path: '/automation',
      active: currentPath === '/automation'
    },
    {
      key: 'benchmark',
      icon: 'speed',
      label: t('common.benchmark'),
      path: '/benchmark',
      active: currentPath === '/benchmark'
    },
    {
      key: 'archive',
      icon: 'archive',
      label: t('common.archivedSessions'),
      path: '/archive',
      active: currentPath === '/archive'
    }
  ]
}

export function buildCompactMoreItems({
  langItems,
  navigate,
  t,
  themeItems,
  themeMode
}: {
  langItems: MenuProps['items']
  navigate: NavigateFunction
  t: TFunction
  themeItems: MenuProps['items']
  themeMode: ThemeMode
}): MenuProps['items'] {
  return [
    {
      key: 'settings',
      label: t('common.settings'),
      icon: <span className='material-symbols-rounded nav-menu-icon'>settings</span>,
      onClick: () => {
        void navigate('/config')
      }
    },
    {
      key: 'theme',
      label: t('common.theme'),
      icon: (
        <span className='material-symbols-rounded nav-menu-icon'>
          {themeMode === 'light' ? 'light_mode' : themeMode === 'dark' ? 'dark_mode' : 'desktop_windows'}
        </span>
      ),
      children: themeItems
    },
    {
      key: 'language',
      label: t('common.language'),
      icon: <span className='material-symbols-rounded nav-menu-icon'>language</span>,
      children: langItems
    }
  ]
}
