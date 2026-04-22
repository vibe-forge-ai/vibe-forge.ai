import './NewSessionGuide.scss'

import { App } from 'antd'
import { useAtom } from 'jotai'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import type { EntitySummary, SpecSummary, WorkspaceSummary } from '#~/api.js'
import { createChatSessionTargetDraft } from '#~/hooks/chat/chat-session-target'
import type { ChatSessionTargetDraft } from '#~/hooks/chat/chat-session-target'
import { useResponsiveLayout } from '#~/hooks/use-responsive-layout'
import { showAnnouncementsAtom } from '#~/store/index.js'
import { NewSessionGuideCompactPanel } from './NewSessionGuideCompactPanel'
import { NewSessionGuideGrid } from './NewSessionGuideGrid'

export function NewSessionGuide({
  selectedTarget,
  onSelectTarget
}: {
  selectedTarget: ChatSessionTargetDraft
  onSelectTarget: (target: ChatSessionTargetDraft) => void
}) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { isCompactLayout } = useResponsiveLayout()
  const [showAnnouncements, setShowAnnouncements] = useAtom(showAnnouncementsAtom)

  const { data: specsRes } = useSWR<{ specs: SpecSummary[] }>('/api/ai/specs')
  const { data: entitiesRes } = useSWR<{ entities: EntitySummary[] }>('/api/ai/entities')
  const { data: workspacesRes } = useSWR<{ workspaces: WorkspaceSummary[] }>('/api/ai/workspaces')
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
  const workspaces = workspacesRes?.workspaces ?? []
  const isSpecsReady = specsRes != null
  const isEntitiesReady = entitiesRes != null
  const isWorkspacesReady = workspacesRes != null
  const { announcements = [] } = configRes?.sources.merged?.general ?? {}

  const handleCreateSpec = () => {
    message.info(t('chat.newSessionGuide.specs.createToast'))
  }

  const handleCreateEntity = () => {
    message.info(t('chat.newSessionGuide.entities.createToast'))
  }

  const isSelected = (type: ChatSessionTargetDraft['type'], name: string) =>
    selectedTarget.type === type && selectedTarget.name === name

  const workspaceItems = useMemo(() =>
    workspaces.map(workspace => ({
      key: workspace.id,
      name: workspace.name,
      description: workspace.description || workspace.path,
      meta: workspace.path,
      active: isSelected('workspace', workspace.id),
      onSelect: () => onSelectTarget(createChatSessionTargetDraft('workspace', workspace))
    })), [onSelectTarget, selectedTarget.name, selectedTarget.type, workspaces])

  const specItems = useMemo(() =>
    alwaysSpecs.map(spec => ({
      key: spec.id,
      name: spec.name,
      description: spec.description,
      meta: spec.params.length > 0 ? t('chat.newSessionGuide.specs.params', { count: spec.params.length }) : undefined,
      active: isSelected('spec', spec.name),
      onSelect: () => onSelectTarget(createChatSessionTargetDraft('spec', spec))
    })), [alwaysSpecs, onSelectTarget, selectedTarget.name, selectedTarget.type, t])

  const entityItems = useMemo(() =>
    entities.map(entity => ({
      key: entity.id,
      name: entity.name,
      description: entity.description,
      active: isSelected('entity', entity.name),
      onSelect: () => onSelectTarget(createChatSessionTargetDraft('entity', entity))
    })), [entities, onSelectTarget, selectedTarget.name, selectedTarget.type])

  const visibleAnnouncements = isCompactLayout ? announcements.slice(0, 1) : announcements
  const visibleWorkspaceItems = isCompactLayout ? workspaceItems.slice(0, 1) : workspaceItems
  const visibleSpecItems = isCompactLayout ? specItems.slice(0, 1) : specItems
  const visibleEntityItems = isCompactLayout ? entityItems.slice(0, 1) : entityItems
  const hiddenAnnouncementCount = Math.max(announcements.length - visibleAnnouncements.length, 0)
  const hiddenWorkspaceCount = Math.max(workspaceItems.length - visibleWorkspaceItems.length, 0)
  const hiddenSpecCount = Math.max(specItems.length - visibleSpecItems.length, 0)
  const hiddenEntityCount = Math.max(entityItems.length - visibleEntityItems.length, 0)

  const renderMoreCount = (count: number) =>
    count > 0
      ? <div className='new-session-guide__more'>{t('chat.newSessionGuide.moreCount', { count })}</div>
      : null

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
            entityItems={entityItems}
            hiddenEntityCount={hiddenEntityCount}
            hiddenSpecCount={hiddenSpecCount}
            hiddenWorkspaceCount={hiddenWorkspaceCount}
            isEntitiesReady={isEntitiesReady}
            isSpecsReady={isSpecsReady}
            isWorkspacesReady={isWorkspacesReady}
            onCreateEntity={handleCreateEntity}
            onCreateSpec={handleCreateSpec}
            renderMoreCount={renderMoreCount}
            specItems={specItems}
            visibleEntityItems={visibleEntityItems}
            visibleSpecItems={visibleSpecItems}
            visibleWorkspaceItems={visibleWorkspaceItems}
            workspaceItems={workspaceItems}
          />
        )
        : (
          <NewSessionGuideGrid
            entityItems={entityItems}
            isEntitiesReady={isEntitiesReady}
            isSpecsReady={isSpecsReady}
            isWorkspacesReady={isWorkspacesReady}
            onCreateEntity={handleCreateEntity}
            onCreateSpec={handleCreateSpec}
            renderMoreCount={renderMoreCount}
            specItems={specItems}
            workspaceItems={workspaceItems}
          />
        )}
    </div>
  )
}
