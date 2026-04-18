import './NewSessionGuide.scss'

import { App } from 'antd'
import { useAtom } from 'jotai'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import type { EntitySummary, SpecSummary, WorkspaceSummary } from '#~/api.js'
import { createChatSessionTargetDraft } from '#~/hooks/chat/chat-session-target'
import type { ChatSessionTargetDraft } from '#~/hooks/chat/chat-session-target'
import { showAnnouncementsAtom } from '#~/store/index.js'
import { NewSessionGuideResourceCard } from './NewSessionGuideResourceCard'

export function NewSessionGuide({
  selectedTarget,
  onSelectTarget
}: {
  selectedTarget: ChatSessionTargetDraft
  onSelectTarget: (target: ChatSessionTargetDraft) => void
}) {
  const { t } = useTranslation()
  const { message } = App.useApp()
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

  return (
    <div className='new-session-guide'>
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
            {announcements.map((item, index) => (
              <div key={`${item}-${index}`} className='new-session-guide__announcements-item'>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className='new-session-guide__grid'>
        <NewSessionGuideResourceCard
          icon='workspaces'
          title={t('chat.newSessionGuide.workspaces.title')}
          count={workspaces.length}
          isReady={isWorkspacesReady}
          items={workspaceItems}
          emptyText={t('chat.newSessionGuide.workspaces.empty')}
        />

        <NewSessionGuideResourceCard
          icon='account_tree'
          title={t('chat.newSessionGuide.specs.title')}
          count={alwaysSpecs.length}
          isReady={isSpecsReady}
          items={specItems}
          emptyText={t('chat.newSessionGuide.specs.empty')}
          createLabel={t('chat.newSessionGuide.specs.create')}
          onCreate={handleCreateSpec}
        />

        <NewSessionGuideResourceCard
          icon='group_work'
          title={t('chat.newSessionGuide.entities.title')}
          count={entities.length}
          isReady={isEntitiesReady}
          items={entityItems}
          emptyText={t('chat.newSessionGuide.entities.empty')}
          createLabel={t('chat.newSessionGuide.entities.create')}
          onCreate={handleCreateEntity}
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
