import { Button, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import { useAtom } from 'jotai'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { themeAtom } from '#~/store'
import { buildLanguageItems, buildThemeItems } from '../nav-rail-items'

export function SidebarUtilityFooter() {
  const { t, i18n } = useTranslation()
  const [themeMode, setThemeMode] = useAtom(themeAtom)
  const navigate = useNavigate()

  const languageItems: MenuProps['items'] = useMemo(() =>
    buildLanguageItems({
      currentLanguage: i18n.language,
      onChangeLanguage: (language) => i18n.changeLanguage(language)
    }), [i18n.language])

  const themeItems: MenuProps['items'] = useMemo(() =>
    buildThemeItems({
      setThemeMode,
      t,
      themeMode
    }), [setThemeMode, t, themeMode])

  return (
    <div className='sidebar-utility-footer'>
      <Dropdown menu={{ items: themeItems, triggerSubMenuAction: 'click' }} placement='topLeft' trigger={['click']}>
        <Button
          type='text'
          className='sidebar-utility-footer__action'
          icon={
            <span className='material-symbols-rounded'>
              {themeMode === 'light' ? 'light_mode' : themeMode === 'dark' ? 'dark_mode' : 'desktop_windows'}
            </span>
          }
        >
          <span>{t('common.theme')}</span>
        </Button>
      </Dropdown>

      <Dropdown
        menu={{ items: languageItems, triggerSubMenuAction: 'click' }}
        placement='topLeft'
        trigger={['click']}
      >
        <Button
          type='text'
          className='sidebar-utility-footer__action'
          icon={<span className='material-symbols-rounded'>language</span>}
        >
          <span>{t('common.language')}</span>
        </Button>
      </Dropdown>

      <Button
        type='text'
        className='sidebar-utility-footer__action'
        icon={<span className='material-symbols-rounded'>settings</span>}
        onClick={() => void navigate('/config')}
      >
        <span>{t('common.settings')}</span>
      </Button>
    </div>
  )
}
