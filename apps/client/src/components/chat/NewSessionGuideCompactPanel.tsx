import { Button } from 'antd'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { NewSessionGuideResourceItem } from './NewSessionGuideResourceCard'

function CompactResourceRow({
  count,
  emptyText,
  hiddenCount,
  icon,
  isReady,
  item,
  title,
  renderMoreCount,
  createLabel,
  onCreate
}: {
  count: number
  emptyText: string
  hiddenCount: number
  icon: string
  isReady: boolean
  item?: NewSessionGuideResourceItem
  title: string
  renderMoreCount: (count: number) => ReactNode
  createLabel?: string
  onCreate?: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className='new-session-guide__compact-row'>
      <div className='new-session-guide__compact-row-header'>
        <div className='new-session-guide__title'>
          <span className='material-symbols-rounded new-session-guide__title-icon'>{icon}</span>
          <span>{title}</span>
        </div>
        <div className='new-session-guide__count'>{count}</div>
      </div>

      {!isReady && (
        <div className='new-session-guide__loading'>{t('chat.newSessionGuide.loading')}</div>
      )}

      {isReady && item != null && (
        <button
          type='button'
          className={[
            'new-session-guide__compact-row-main',
            'new-session-guide__compact-row-main--button',
            item.active === true ? 'is-active' : ''
          ].filter(Boolean).join(' ')}
          aria-pressed={item.active === true}
          onClick={item.onSelect}
        >
          <div className='new-session-guide__compact-primary-title'>{item.name}</div>
          {item.description != null && item.description !== '' && (
            <div className='new-session-guide__compact-primary-desc'>{item.description}</div>
          )}
          {item.meta != null && item.meta !== '' && (
            <div className='new-session-guide__meta'>{item.meta}</div>
          )}
          {renderMoreCount(hiddenCount)}
        </button>
      )}

      {isReady && item == null && (
        <div className='new-session-guide__compact-inline-actions'>
          <div className='new-session-guide__empty-desc'>{emptyText}</div>
          {createLabel != null && onCreate != null && (
            <Button type='primary' size='small' onClick={onCreate}>
              {createLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export function NewSessionGuideCompactPanel({
  entityItems,
  hiddenEntityCount,
  hiddenSpecCount,
  hiddenWorkspaceCount,
  isEntitiesReady,
  isSpecsReady,
  isWorkspacesReady,
  onCreateEntity,
  onCreateSpec,
  renderMoreCount,
  specItems,
  visibleEntityItems,
  visibleSpecItems,
  visibleWorkspaceItems,
  workspaceItems
}: {
  entityItems: NewSessionGuideResourceItem[]
  hiddenEntityCount: number
  hiddenSpecCount: number
  hiddenWorkspaceCount: number
  isEntitiesReady: boolean
  isSpecsReady: boolean
  isWorkspacesReady: boolean
  onCreateEntity: () => void
  onCreateSpec: () => void
  renderMoreCount: (count: number) => ReactNode
  specItems: NewSessionGuideResourceItem[]
  visibleEntityItems: NewSessionGuideResourceItem[]
  visibleSpecItems: NewSessionGuideResourceItem[]
  visibleWorkspaceItems: NewSessionGuideResourceItem[]
  workspaceItems: NewSessionGuideResourceItem[]
}) {
  const { t } = useTranslation()

  return (
    <div className='new-session-guide__compact-panel'>
      <CompactResourceRow
        count={workspaceItems.length}
        emptyText={t('chat.newSessionGuide.workspaces.empty')}
        hiddenCount={hiddenWorkspaceCount}
        icon='workspaces'
        isReady={isWorkspacesReady}
        item={visibleWorkspaceItems[0]}
        title={t('chat.newSessionGuide.workspaces.title')}
        renderMoreCount={renderMoreCount}
      />

      <CompactResourceRow
        count={specItems.length}
        emptyText={t('chat.newSessionGuide.specs.empty')}
        hiddenCount={hiddenSpecCount}
        icon='account_tree'
        isReady={isSpecsReady}
        item={visibleSpecItems[0]}
        title={t('chat.newSessionGuide.specs.title')}
        createLabel={t('chat.newSessionGuide.specs.create')}
        onCreate={onCreateSpec}
        renderMoreCount={renderMoreCount}
      />

      <CompactResourceRow
        count={entityItems.length}
        emptyText={t('chat.newSessionGuide.entities.empty')}
        hiddenCount={hiddenEntityCount}
        icon='group_work'
        isReady={isEntitiesReady}
        item={visibleEntityItems[0]}
        title={t('chat.newSessionGuide.entities.title')}
        createLabel={t('chat.newSessionGuide.entities.create')}
        onCreate={onCreateEntity}
        renderMoreCount={renderMoreCount}
      />
    </div>
  )
}
