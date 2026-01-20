import './NavRail.scss'

import { Button, Dropdown, Tooltip } from 'antd'
import type { MenuProps } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

export function NavRail() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  const currentPath = location.pathname

  const langItems: MenuProps['items'] = React.useMemo(() => [
    {
      key: 'zh',
      label: '简体中文',
      icon: i18n.language.startsWith('zh')
        ? (
          <span className='material-symbols-outlined' style={{ fontSize: '18px', color: '#2563eb' }}>check</span>
        )
        : <div style={{ width: '18px' }} />,
      onClick: () => {
        void i18n.changeLanguage('zh')
      }
    },
    {
      key: 'en',
      label: 'English',
      icon: i18n.language.startsWith('en')
        ? (
          <span className='material-symbols-outlined' style={{ fontSize: '18px', color: '#2563eb' }}>check</span>
        )
        : <div style={{ width: '18px' }} />,
      onClick: () => {
        void i18n.changeLanguage('en')
      }
    }
  ], [i18n.language])

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
            <Button
              type='text'
              className={`nav-item ${item.active ? 'active' : ''}`}
              onClick={() => void navigate(item.path)}
              icon={<span className='material-symbols-outlined'>{item.icon}</span>}
            />
          </Tooltip>
        ))}
      </div>
      <div className='nav-rail-bottom'>
        <Tooltip title={t('common.language')} placement='right'>
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
              icon={<span className='material-symbols-outlined'>language</span>}
            />
          </Dropdown>
        </Tooltip>
        <Tooltip title={t('common.theme')} placement='right'>
          <Button
            type='text'
            className='nav-item'
            icon={<span className='material-symbols-outlined'>palette</span>}
          />
        </Tooltip>
        <Tooltip title={t('common.settings')} placement='right'>
          <Button
            type='text'
            className='nav-item'
            icon={<span className='material-symbols-outlined'>settings</span>}
          />
        </Tooltip>
      </div>
    </div>
  )
}
