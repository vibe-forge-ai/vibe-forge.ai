import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { NewSessionGuideResourceCard } from './NewSessionGuideResourceCard'
import type { NewSessionGuideResourceItem } from './NewSessionGuideResourceCard'

export function NewSessionGuideGrid({
  entityItems,
  hiddenHelpCount,
  isEntitiesReady,
  isSpecsReady,
  isWorkspacesReady,
  onCreateEntity,
  onCreateSpec,
  renderMoreCount,
  specItems,
  visibleHelpItems,
  workspaceItems
}: {
  entityItems: NewSessionGuideResourceItem[]
  hiddenHelpCount: number
  isEntitiesReady: boolean
  isSpecsReady: boolean
  isWorkspacesReady: boolean
  onCreateEntity: () => void
  onCreateSpec: () => void
  renderMoreCount: (count: number) => ReactNode
  specItems: NewSessionGuideResourceItem[]
  visibleHelpItems: string[]
  workspaceItems: NewSessionGuideResourceItem[]
}) {
  const { t } = useTranslation()

  return (
    <div className='new-session-guide__grid'>
      <NewSessionGuideResourceCard
        icon='workspaces'
        title={t('chat.newSessionGuide.workspaces.title')}
        count={workspaceItems.length}
        isReady={isWorkspacesReady}
        items={workspaceItems}
        emptyText={t('chat.newSessionGuide.workspaces.empty')}
      />

      <NewSessionGuideResourceCard
        icon='account_tree'
        title={t('chat.newSessionGuide.specs.title')}
        count={specItems.length}
        isReady={isSpecsReady}
        items={specItems}
        emptyText={t('chat.newSessionGuide.specs.empty')}
        createLabel={t('chat.newSessionGuide.specs.create')}
        onCreate={onCreateSpec}
      />

      <NewSessionGuideResourceCard
        icon='group_work'
        title={t('chat.newSessionGuide.entities.title')}
        count={entityItems.length}
        isReady={isEntitiesReady}
        items={entityItems}
        emptyText={t('chat.newSessionGuide.entities.empty')}
        createLabel={t('chat.newSessionGuide.entities.create')}
        onCreate={onCreateEntity}
      />

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
