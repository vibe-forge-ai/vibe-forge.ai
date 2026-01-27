import './NavRail.scss'

import { Button, Dropdown, Tooltip } from 'antd'
import type { MenuProps } from 'antd'
import { useAtom } from 'jotai'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

import { themeAtom } from '../store'
import type { ThemeMode } from '../store'

export function NavRail({
  collapsed,
  onToggleCollapse
}: {
  collapsed?: boolean
  onToggleCollapse?: () => void
}) {
  const { t, i18n } = useTranslation()
  const [themeMode, setThemeMode] = useAtom(themeAtom)
  const navigate = useNavigate()
  const location = useLocation()

  const currentPath = location.pathname

  const langItems: MenuProps['items'] = React.useMemo(() => [
    {
      key: 'zh',
      label: '简体中文',
      icon: i18n.language.startsWith('zh')
        ? (
          <span className='material-symbols-rounded nav-menu-icon active'>check</span>
        )
        : <div className='nav-menu-icon-placeholder' />,
      onClick: () => {
        void i18n.changeLanguage('zh')
      }
    },
    {
      key: 'en',
      label: 'English',
      icon: i18n.language.startsWith('en')
        ? (
          <span className='material-symbols-rounded nav-menu-icon active'>check</span>
        )
        : <div className='nav-menu-icon-placeholder' />,
      onClick: () => {
        void i18n.changeLanguage('en')
      }
    }
  ], [i18n.language])

  const themeItems: MenuProps['items'] = React.useMemo(() => [
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
  ], [themeMode, t, setThemeMode])

  const navItems = React.useMemo(() => [
    {
      key: 'sessions',
      icon: 'chat_bubble',
      label: t('common.sessions'),
      path: '/',
      active: currentPath === '/' || currentPath.startsWith('/session/')
    },
    {
      key: 'search',
      icon: 'search',
      label: t('common.search'),
      path: '/search',
      active: currentPath === '/search'
    },
    {
      key: 'archive',
      icon: 'archive',
      label: t('common.archivedSessions'),
      path: '/archive',
      active: currentPath === '/archive'
    }
  ], [currentPath, t])

  return (
    <div className='nav-rail'>
      <div className='nav-rail-top'>
        {navItems.map(item => (
          <Tooltip key={item.key} title={item.label} placement='right'>
            <span>
              <Button
                type='text'
                className={`nav-item ${item.active ? 'active' : ''}`}
                onClick={() => void navigate(item.path)}
                icon={<span className='material-symbols-rounded'>{item.icon}</span>}
              />
            </span>
          </Tooltip>
        ))}
      </div>
      <div className='nav-rail-bottom'>
        <Tooltip title={t('common.theme')} placement='right'>
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
        <Tooltip title={t('common.language')} placement='right'>
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
        <Tooltip title={t('common.settings')} placement='right'>
          <span>
            <Button
              type='text'
              className='nav-item'
              icon={<span className='material-symbols-rounded'>settings</span>}
            />
          </span>
        </Tooltip>
      </div>
    </div>
  )
}
