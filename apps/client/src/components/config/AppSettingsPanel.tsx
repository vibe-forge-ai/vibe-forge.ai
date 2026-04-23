import '../ConfigView.scss'

import { InputNumber, Select, Switch } from 'antd'
import { useAtom } from 'jotai'

import {
  senderHeaderDisplayAtom,
  sessionListSearchThresholdAtom,
  showAnnouncementsAtom,
  showNewSessionStarterListAtom,
  themeAtom
} from '#~/store/index.js'
import type { SenderHeaderDisplayMode, ThemeMode } from '#~/store/index.js'

import { FieldRow } from './ConfigFieldRow'
import type { TranslationFn } from './configUtils'

export function AppSettingsPanel({ t }: { t: TranslationFn }) {
  const [themeMode, setThemeMode] = useAtom(themeAtom)
  const [showAnnouncements, setShowAnnouncements] = useAtom(showAnnouncementsAtom)
  const [showNewSessionStarterList, setShowNewSessionStarterList] = useAtom(showNewSessionStarterListAtom)
  const [senderHeaderDisplay, setSenderHeaderDisplay] = useAtom(senderHeaderDisplayAtom)
  const [sessionListSearchThreshold, setSessionListSearchThreshold] = useAtom(sessionListSearchThresholdAtom)

  return (
    <div className='config-view__editor-wrap'>
      <div className='config-view__section-header'>
        <div className='config-view__section-title'>
          <span className='material-symbols-rounded config-view__section-icon'>tune</span>
          <span>{t('config.sections.appearance')}</span>
        </div>
      </div>
      <div className='config-view__card'>
        <div className='config-view__app-settings-list'>
          <FieldRow
            title={t('config.appSettings.themeMode.label')}
            description={t('config.appSettings.themeMode.desc')}
            icon='dark_mode'
          >
            <Select<ThemeMode>
              value={themeMode}
              onChange={setThemeMode}
              options={[
                {
                  value: 'light',
                  label: t('common.themeLight')
                },
                {
                  value: 'dark',
                  label: t('common.themeDark')
                },
                {
                  value: 'system',
                  label: t('common.themeSystem')
                }
              ]}
            />
          </FieldRow>
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
            title={t('config.appSettings.sessionListSearchThreshold.label')}
            description={t('config.appSettings.sessionListSearchThreshold.desc')}
            icon='search'
          >
            <InputNumber
              min={0}
              precision={0}
              value={sessionListSearchThreshold}
              onChange={(value) => setSessionListSearchThreshold(value ?? 0)}
            />
          </FieldRow>
          <FieldRow
            title={t('config.appSettings.announcements.label')}
            description={t('config.appSettings.announcements.desc')}
            icon='campaign'
          >
            <Switch checked={showAnnouncements} onChange={setShowAnnouncements} />
          </FieldRow>
          <FieldRow
            title={t('config.appSettings.recommendedActions.label')}
            description={t('config.appSettings.recommendedActions.desc')}
            icon='tips_and_updates'
          >
            <Switch checked={showNewSessionStarterList} onChange={setShowNewSessionStarterList} />
          </FieldRow>
        </div>
      </div>
    </div>
  )
}
