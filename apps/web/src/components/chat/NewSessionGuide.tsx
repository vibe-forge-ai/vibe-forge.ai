import './NewSessionGuide.scss'

import { App, Button } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import type { EntitySummary, SpecSummary } from '#~/api.js'

export function NewSessionGuide() {
  const { t } = useTranslation()
  const { message } = App.useApp()

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
  const entities = entitiesRes?.entities ?? []
  const isSpecsReady = specsRes != null
  const isEntitiesReady = entitiesRes != null
  const { announcements = [] } = configRes?.sources.merged?.general ?? {}

  const helpItems = [
    t('chat.newSessionGuide.help.item1'),
    t('chat.newSessionGuide.help.item2'),
    t('chat.newSessionGuide.help.item3')
  ]

  const handleCreateSpec = () => {
    message.info(t('chat.newSessionGuide.specs.createToast'))
  }

  const handleCreateEntity = () => {
    message.info(t('chat.newSessionGuide.entities.createToast'))
  }

  return (
    <div className='new-session-guide'>
      {announcements.length > 0 && (
        <div className='new-session-guide__announcements'>
          <div className='new-session-guide__announcements-header'>
            <span className='material-symbols-rounded new-session-guide__announcements-icon'>campaign</span>
            <span>{t('chat.newSessionGuide.announcements.title')}</span>
          </div>
          <div className='new-session-guide__announcements-list'>
            {announcements.map((item, index) => (
              <div key={`${item}-${index}`} className='new-session-guide__announcements-item'>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className='new-session-guide__grid'>
        <div className='new-session-guide__card'>
          <div className='new-session-guide__header'>
            <div className='new-session-guide__title'>
              <span className='material-symbols-rounded new-session-guide__title-icon'>account_tree</span>
              <span>{t('chat.newSessionGuide.specs.title')}</span>
            </div>
            <div className='new-session-guide__count'>{specs.length}</div>
          </div>
          <div className='new-session-guide__body'>
            {!isSpecsReady && (
              <div className='new-session-guide__loading'>{t('chat.newSessionGuide.loading')}</div>
            )}
            {isSpecsReady && specs.length > 0 && (
              <div className='new-session-guide__list'>
                {specs.map((spec) => (
                  <div key={spec.id} className='new-session-guide__item'>
                    <div className='new-session-guide__item-title'>
                      <span className='material-symbols-rounded new-session-guide__item-icon'>route</span>
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
              </div>
            )}
            {isSpecsReady && specs.length === 0 && (
              <div className='new-session-guide__empty'>
                <div className='new-session-guide__empty-desc'>{t('chat.newSessionGuide.specs.empty')}</div>
                <Button type='primary' size='small' onClick={handleCreateSpec}>
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
                {entities.map((entity) => (
                  <div key={entity.id} className='new-session-guide__item'>
                    <div className='new-session-guide__item-title'>
                      <span className='material-symbols-rounded new-session-guide__item-icon'>person</span>
                      <span>{entity.name}</span>
                    </div>
                    <div className='new-session-guide__item-desc'>{entity.description}</div>
                  </div>
                ))}
              </div>
            )}
            {isEntitiesReady && entities.length === 0 && (
              <div className='new-session-guide__empty'>
                <div className='new-session-guide__empty-desc'>{t('chat.newSessionGuide.entities.empty')}</div>
                <Button type='primary' size='small' onClick={handleCreateEntity}>
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
              {helpItems.map(item => (
                <div key={item} className='new-session-guide__help-item'>
                  <span className='material-symbols-rounded new-session-guide__help-icon'>check_circle</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className='new-session-guide__help-footer'>
              {t('chat.newSessionGuide.help.footer')}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
