import '../ConfigView.scss'

import { Select, Switch } from 'antd'
import { useAtom } from 'jotai'

import { senderHeaderDisplayAtom, showAnnouncementsAtom } from '#~/store/index.js'
import type { SenderHeaderDisplayMode } from '#~/store/index.js'

import { FieldRow } from './ConfigFieldRow'
import type { TranslationFn } from './configUtils'

export function AppSettingsPanel({ t }: { t: TranslationFn }) {
  const [showAnnouncements, setShowAnnouncements] = useAtom(showAnnouncementsAtom)
  const [senderHeaderDisplay, setSenderHeaderDisplay] = useAtom(senderHeaderDisplayAtom)

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
          title={t('config.appSettings.senderHeaderDisplay.label')}
          description={t('config.appSettings.senderHeaderDisplay.desc')}
          icon='unfold_more'
        >
          <Select<SenderHeaderDisplayMode>
            value={senderHeaderDisplay}
            onChange={setSenderHeaderDisplay}
            options={[
              {
                value: 'expanded',
                label: t('config.appSettings.senderHeaderDisplay.expanded')
              },
              {
                value: 'collapsed',
                label: t('config.appSettings.senderHeaderDisplay.collapsed')
              }
            ]}
          />
        </FieldRow>
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
