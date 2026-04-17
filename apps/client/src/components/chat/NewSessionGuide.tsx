import './NewSessionGuide.scss'

import { App } from 'antd'
import { useAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import type { EntitySummary, SpecSummary } from '#~/api.js'
import { useResponsiveLayout } from '#~/hooks/use-responsive-layout'
import { showAnnouncementsAtom } from '#~/store/index.js'
import { NewSessionGuideCompactPanel } from './NewSessionGuideCompactPanel'
import { NewSessionGuideGrid } from './NewSessionGuideGrid'

export function NewSessionGuide() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { isCompactLayout } = useResponsiveLayout()
  const [showAnnouncements, setShowAnnouncements] = useAtom(showAnnouncementsAtom)

  const { data: specsRes } = useSWR<{ specs: SpecSummary[] }>('/api/ai/specs')
  const { data: entitiesRes } = useSWR<{ entities: EntitySummary[] }>('/api/ai/entities')
  const { data: configRes } = useSWR<{
    sources: {
      merged: {
        general?: {
          announcements: string[]
        }
      }
    }
  }>(
    '/api/config'
  )

  const specs = specsRes?.specs ?? []
  const alwaysSpecs = specs.filter(spec => spec.always)
  const entities = entitiesRes?.entities ?? []
  const isSpecsReady = specsRes != null
  const isEntitiesReady = entitiesRes != null
  const { announcements = [] } = configRes?.sources.merged?.general ?? {}

  const helpItems = [
    t('chat.newSessionGuide.help.item1'),
    t('chat.newSessionGuide.help.item2'),
    t('chat.newSessionGuide.help.item3')
  ]
  const visibleAnnouncements = isCompactLayout ? announcements.slice(0, 1) : announcements
  const visibleSpecs = isCompactLayout ? alwaysSpecs.slice(0, 1) : alwaysSpecs
  const visibleEntities = isCompactLayout ? entities.slice(0, 1) : entities
  const visibleHelpItems = isCompactLayout ? helpItems.slice(0, 1) : helpItems
  const hiddenAnnouncementCount = Math.max(announcements.length - visibleAnnouncements.length, 0)
  const hiddenSpecCount = Math.max(alwaysSpecs.length - visibleSpecs.length, 0)
  const hiddenEntityCount = Math.max(entities.length - visibleEntities.length, 0)
  const hiddenHelpCount = Math.max(helpItems.length - visibleHelpItems.length, 0)

  const renderMoreCount = (count: number) =>
    count > 0
      ? <div className='new-session-guide__more'>{t('chat.newSessionGuide.moreCount', { count })}</div>
      : null

  const handleCreateSpec = () => {
    message.info(t('chat.newSessionGuide.specs.createToast'))
  }

  const handleCreateEntity = () => {
    message.info(t('chat.newSessionGuide.entities.createToast'))
  }

  return (
    <div className={`new-session-guide ${isCompactLayout ? 'new-session-guide--compact' : ''}`}>
      {showAnnouncements && announcements.length > 0 && (
        <div className='new-session-guide__announcements'>
          <div className='new-session-guide__announcements-header'>
            <div className='new-session-guide__announcements-title'>
              <span className='material-symbols-rounded new-session-guide__announcements-icon'>campaign</span>
              <span>{t('chat.newSessionGuide.announcements.title')}</span>
            </div>
            <button
              type='button'
              className='new-session-guide__announcements-close'
              onClick={() => setShowAnnouncements(false)}
            >
              <span className='material-symbols-rounded'>close</span>
            </button>
          </div>
          <div className='new-session-guide__announcements-list'>
            {visibleAnnouncements.map((item, index) => (
              <div key={`${item}-${index}`} className='new-session-guide__announcements-item'>
                <span>{item}</span>
              </div>
            ))}
            {renderMoreCount(hiddenAnnouncementCount)}
          </div>
        </div>
      )}

      {isCompactLayout
        ? (
          <NewSessionGuideCompactPanel
            alwaysSpecs={alwaysSpecs}
            entities={entities}
            helpItems={helpItems}
            hiddenEntityCount={hiddenEntityCount}
            hiddenHelpCount={hiddenHelpCount}
            hiddenSpecCount={hiddenSpecCount}
            isEntitiesReady={isEntitiesReady}
            isSpecsReady={isSpecsReady}
            onCreateEntity={handleCreateEntity}
            onCreateSpec={handleCreateSpec}
            renderMoreCount={renderMoreCount}
            visibleEntities={visibleEntities}
            visibleHelpItems={visibleHelpItems}
            visibleSpecs={visibleSpecs}
          />
        )
        : (
          <NewSessionGuideGrid
            alwaysSpecs={alwaysSpecs}
            entities={entities}
            hiddenEntityCount={hiddenEntityCount}
            hiddenHelpCount={hiddenHelpCount}
            hiddenSpecCount={hiddenSpecCount}
            isEntitiesReady={isEntitiesReady}
            isSpecsReady={isSpecsReady}
            onCreateEntity={handleCreateEntity}
            onCreateSpec={handleCreateSpec}
            renderMoreCount={renderMoreCount}
            visibleEntities={visibleEntities}
            visibleHelpItems={visibleHelpItems}
            visibleSpecs={visibleSpecs}
          />
        )}
    </div>
  )
}
