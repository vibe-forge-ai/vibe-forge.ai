import { Button } from 'antd'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { EntitySummary, SpecSummary } from '#~/api.js'

export function NewSessionGuideCompactPanel({
  alwaysSpecs,
  entities,
  helpItems,
  hiddenEntityCount,
  hiddenHelpCount,
  hiddenSpecCount,
  isEntitiesReady,
  isSpecsReady,
  onCreateEntity,
  onCreateSpec,
  renderMoreCount,
  visibleEntities,
  visibleHelpItems,
  visibleSpecs
}: {
  alwaysSpecs: SpecSummary[]
  entities: EntitySummary[]
  helpItems: string[]
  hiddenEntityCount: number
  hiddenHelpCount: number
  hiddenSpecCount: number
  isEntitiesReady: boolean
  isSpecsReady: boolean
  onCreateEntity: () => void
  onCreateSpec: () => void
  renderMoreCount: (count: number) => ReactNode
  visibleEntities: EntitySummary[]
  visibleHelpItems: string[]
  visibleSpecs: SpecSummary[]
}) {
  const { t } = useTranslation()

  return (
    <div className='new-session-guide__compact-panel'>
      <div className='new-session-guide__compact-row'>
        <div className='new-session-guide__compact-row-header'>
          <div className='new-session-guide__title'>
            <span className='material-symbols-rounded new-session-guide__title-icon'>account_tree</span>
            <span>{t('chat.newSessionGuide.specs.title')}</span>
          </div>
          <div className='new-session-guide__count'>{alwaysSpecs.length}</div>
        </div>

        {!isSpecsReady && (
          <div className='new-session-guide__loading'>{t('chat.newSessionGuide.loading')}</div>
        )}

        {isSpecsReady && alwaysSpecs.length > 0 && visibleSpecs[0] != null && (
          <div className='new-session-guide__compact-row-main'>
            <div className='new-session-guide__compact-primary-title'>{visibleSpecs[0].name}</div>
            <div className='new-session-guide__compact-primary-desc'>{visibleSpecs[0].description}</div>
            {visibleSpecs[0].params.length > 0 && (
              <div className='new-session-guide__meta'>
                {t('chat.newSessionGuide.specs.params', { count: visibleSpecs[0].params.length })}
              </div>
            )}
            {renderMoreCount(hiddenSpecCount)}
          </div>
        )}

        {isSpecsReady && alwaysSpecs.length === 0 && (
          <div className='new-session-guide__compact-inline-actions'>
            <div className='new-session-guide__empty-desc'>{t('chat.newSessionGuide.specs.empty')}</div>
            <Button type='primary' size='small' onClick={onCreateSpec}>
              {t('chat.newSessionGuide.specs.create')}
            </Button>
          </div>
        )}
      </div>

      <div className='new-session-guide__compact-row'>
        <div className='new-session-guide__compact-row-header'>
          <div className='new-session-guide__title'>
            <span className='material-symbols-rounded new-session-guide__title-icon'>group_work</span>
            <span>{t('chat.newSessionGuide.entities.title')}</span>
          </div>
          <div className='new-session-guide__count'>{entities.length}</div>
        </div>

        {!isEntitiesReady && (
          <div className='new-session-guide__loading'>{t('chat.newSessionGuide.loading')}</div>
        )}

        {isEntitiesReady && entities.length > 0 && visibleEntities[0] != null && (
          <div className='new-session-guide__compact-row-main'>
            <div className='new-session-guide__compact-primary-title'>{visibleEntities[0].name}</div>
            <div className='new-session-guide__compact-primary-desc'>{visibleEntities[0].description}</div>
            {renderMoreCount(hiddenEntityCount)}
          </div>
        )}

        {isEntitiesReady && entities.length === 0 && (
          <div className='new-session-guide__compact-inline-actions'>
            <div className='new-session-guide__empty-desc'>{t('chat.newSessionGuide.entities.empty')}</div>
            <Button type='primary' size='small' onClick={onCreateEntity}>
              {t('chat.newSessionGuide.entities.create')}
            </Button>
          </div>
        )}
      </div>

      <div className='new-session-guide__compact-row'>
        <div className='new-session-guide__compact-row-header'>
          <div className='new-session-guide__title'>
            <span className='material-symbols-rounded new-session-guide__title-icon'>tips_and_updates</span>
            <span>{t('chat.newSessionGuide.help.title')}</span>
          </div>
          <div className='new-session-guide__count'>{helpItems.length}</div>
        </div>

        <div className='new-session-guide__compact-row-main'>
          {visibleHelpItems[0] != null && (
            <div className='new-session-guide__compact-help-item'>
              <span className='material-symbols-rounded new-session-guide__help-icon'>check_circle</span>
              <span>{visibleHelpItems[0]}</span>
            </div>
          )}
          {renderMoreCount(hiddenHelpCount)}
        </div>
      </div>
    </div>
  )
}
