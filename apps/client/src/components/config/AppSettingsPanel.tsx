import '../ConfigView.scss'

import { Switch } from 'antd'
import { useAtom } from 'jotai'

import { showAnnouncementsAtom } from '#~/store/index.js'

import { FieldRow } from './ConfigFieldRow'
import type { TranslationFn } from './configUtils'

export function AppSettingsPanel({ t }: { t: TranslationFn }) {
  const [showAnnouncements, setShowAnnouncements] = useAtom(showAnnouncementsAtom)

  return (
    <div className='config-view__editor-wrap'>
      <div className='config-view__section-header'>
        <div className='config-view__section-title'>
          <span className='material-symbols-rounded config-view__section-icon'>tune</span>
          <span>{t('config.sections.appearance')}</span>
        </div>
      </div>
      <div className='config-view__card'>
        <FieldRow
          title={t('config.appSettings.announcements.label')}
          description={t('config.appSettings.announcements.desc')}
          icon='campaign'
        >
          <Switch checked={showAnnouncements} onChange={setShowAnnouncements} />
        </FieldRow>
      </div>
    </div>
  )
}
