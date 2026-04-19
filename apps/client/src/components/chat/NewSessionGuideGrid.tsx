import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { NewSessionGuideResourceCard } from './NewSessionGuideResourceCard'
import type { NewSessionGuideResourceItem } from './NewSessionGuideResourceCard'

export function NewSessionGuideGrid({
  entityItems,
  isEntitiesReady,
  isSpecsReady,
  isWorkspacesReady,
  onCreateEntity,
  onCreateSpec,
  renderMoreCount,
  specItems,
  workspaceItems
}: {
  entityItems: NewSessionGuideResourceItem[]
  isEntitiesReady: boolean
  isSpecsReady: boolean
  isWorkspacesReady: boolean
  onCreateEntity: () => void
  onCreateSpec: () => void
  renderMoreCount: (count: number) => ReactNode
  specItems: NewSessionGuideResourceItem[]
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
    </div>
  )
}
