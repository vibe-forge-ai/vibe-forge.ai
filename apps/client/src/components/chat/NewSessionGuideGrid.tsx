import { Button } from 'antd'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { EntitySummary, SpecSummary } from '#~/api.js'

export function NewSessionGuideGrid({
  alwaysSpecs,
  entities,
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
    <div className='new-session-guide__grid'>
      <div className='new-session-guide__card'>
        <div className='new-session-guide__header'>
          <div className='new-session-guide__title'>
            <span className='material-symbols-rounded new-session-guide__title-icon'>account_tree</span>
            <span>{t('chat.newSessionGuide.specs.title')}</span>
          </div>
          <div className='new-session-guide__count'>{alwaysSpecs.length}</div>
        </div>
        <div className='new-session-guide__body'>
          {!isSpecsReady && (
            <div className='new-session-guide__loading'>{t('chat.newSessionGuide.loading')}</div>
          )}
          {isSpecsReady && alwaysSpecs.length > 0 && (
            <div className='new-session-guide__list'>
              {visibleSpecs.map((spec) => (
                <div key={spec.id} className='new-session-guide__item'>
                  <div className='new-session-guide__item-title'>
                    <span>{spec.name}</span>
                  </div>
                  <div className='new-session-guide__item-desc'>{spec.description}</div>
                  {spec.params.length > 0 && (
                    <div className='new-session-guide__meta'>
                      {t('chat.newSessionGuide.specs.params', { count: spec.params.length })}
                    </div>
                  )}
                </div>
              ))}
              {renderMoreCount(hiddenSpecCount)}
            </div>
          )}
          {isSpecsReady && alwaysSpecs.length === 0 && (
            <div className='new-session-guide__empty'>
              <div className='new-session-guide__empty-desc'>{t('chat.newSessionGuide.specs.empty')}</div>
              <Button type='primary' size='small' onClick={onCreateSpec}>
                {t('chat.newSessionGuide.specs.create')}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className='new-session-guide__card'>
        <div className='new-session-guide__header'>
          <div className='new-session-guide__title'>
            <span className='material-symbols-rounded new-session-guide__title-icon'>group_work</span>
            <span>{t('chat.newSessionGuide.entities.title')}</span>
          </div>
          <div className='new-session-guide__count'>{entities.length}</div>
        </div>
        <div className='new-session-guide__body'>
          {!isEntitiesReady && (
            <div className='new-session-guide__loading'>{t('chat.newSessionGuide.loading')}</div>
          )}
          {isEntitiesReady && entities.length > 0 && (
            <div className='new-session-guide__list'>
              {visibleEntities.map((entity) => (
                <div key={entity.id} className='new-session-guide__item'>
                  <div className='new-session-guide__item-title'>
                    <span>{entity.name}</span>
                  </div>
                  <div className='new-session-guide__item-desc'>{entity.description}</div>
                </div>
              ))}
              {renderMoreCount(hiddenEntityCount)}
            </div>
          )}
          {isEntitiesReady && entities.length === 0 && (
            <div className='new-session-guide__empty'>
              <div className='new-session-guide__empty-desc'>{t('chat.newSessionGuide.entities.empty')}</div>
              <Button type='primary' size='small' onClick={onCreateEntity}>
                {t('chat.newSessionGuide.entities.create')}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className='new-session-guide__card'>
        <div className='new-session-guide__header'>
          <div className='new-session-guide__title'>
            <span className='material-symbols-rounded new-session-guide__title-icon'>tips_and_updates</span>
            <span>{t('chat.newSessionGuide.help.title')}</span>
          </div>
        </div>
        <div className='new-session-guide__body'>
          <div className='new-session-guide__help'>
            {visibleHelpItems.map(item => (
              <div key={item} className='new-session-guide__help-item'>
                <span className='material-symbols-rounded new-session-guide__help-icon'>check_circle</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
          {renderMoreCount(hiddenHelpCount)}
          <div className='new-session-guide__help-footer'>
            {t('chat.newSessionGuide.help.footer')}
          </div>
        </div>
      </div>
    </div>
  )
}
