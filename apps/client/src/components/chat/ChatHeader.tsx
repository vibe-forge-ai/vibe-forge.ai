import './ChatHeader.scss'

import type { SessionStatus } from '@vibe-forge/core'
import type { SessionInfo } from '@vibe-forge/types'
import { App, Button, Dropdown, Radio } from 'antd'
import type { MenuProps } from 'antd'
import { useAtomValue } from 'jotai'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { deleteSession, getApiErrorMessage, updateSession } from '../../api'
import { isSidebarCollapsedAtom, isSidebarResizingAtom } from '../../store/index'
import { ConfigSectionPanel } from '../config'
import type { FieldSpec } from '../config/configSchema'
import {
  formatToolLabel,
  getSessionAssetWarnings,
  getSessionSelectionWarnings,
  getSessionToolGroups
} from './session-metadata'

export type ChatHeaderView = 'history' | 'timeline' | 'settings'

export function ChatHeader({
  sessionInfo,
  sessionId,
  sessionTitle,
  sessionStatus,
  isStarred,
  isArchived,
  tags,
  lastMessage,
  lastUserMessage,
  activeView,
  onViewChange
}: {
  sessionInfo: SessionInfo | null
  sessionId?: string
  sessionTitle?: string
  sessionStatus?: SessionStatus
  isStarred?: boolean
  isArchived?: boolean
  tags?: string[]
  lastMessage?: string
  lastUserMessage?: string
  activeView: ChatHeaderView
  onViewChange: (view: ChatHeaderView) => void
}) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const isSidebarCollapsed = useAtomValue(isSidebarCollapsedAtom)
  const isResizing = useAtomValue(isSidebarResizingAtom)

  const summary = sessionInfo?.type === 'summary' ? sessionInfo.summary : null
  const title = (sessionInfo?.type === 'init' ? sessionInfo.title : null) ?? sessionTitle
  const displayTitle = (title != null && title !== '')
    ? title
    : (summary != null && summary !== '')
    ? summary
    : (lastUserMessage != null && lastUserMessage !== '')
    ? lastUserMessage
    : (lastMessage != null && lastMessage !== '')
    ? lastMessage
    : t('common.newChat')

  const handleToggleStar = async () => {
    if (sessionId == null || sessionId === '') return
    try {
      await updateSession(sessionId, { isStarred: !isStarred })
      void message.success(isStarred ? t('common.unstarred') : t('common.starred'))
    } catch (err) {
      void message.error(getApiErrorMessage(err, t('common.operationFailed')))
    }
  }

  const handleToggleArchive = async () => {
    if (sessionId == null || sessionId === '') return
    try {
      await updateSession(sessionId, { isArchived: !isArchived })
      void message.success(isArchived ? t('common.restored') : t('common.archived'))
    } catch (err) {
      void message.error(getApiErrorMessage(err, t('common.operationFailed')))
    }
  }

  const moreItems: MenuProps['items'] = [
    {
      key: 'star',
      label: isStarred ? t('common.unstar') : t('common.star'),
      icon: <span className={`material-symbols-rounded ${isStarred ? 'is-filled' : ''}`} style={{ fontSize: '18px' }}>
        {isStarred ? 'star' : 'star_border'}
      </span>,
      onClick: () => {
        void handleToggleStar()
      }
    },
    {
      key: 'archive',
      label: isArchived ? t('common.restore') : t('common.archive'),
      icon: <span className='material-symbols-rounded' style={{ fontSize: '18px' }}>
        {isArchived ? 'unarchive' : 'archive'}
      </span>,
      onClick: () => {
        void handleToggleArchive()
      }
    }
  ]

  return (
    <div className={`chat-header ${isSidebarCollapsed ? 'is-collapsed' : ''} ${isResizing ? 'is-resizing' : ''}`}>
      <div className='chat-header-main'>
        <div className='chat-header-info'>
          <div className='chat-header-title-row'>
            <div className='chat-header-title'>
              {displayTitle}
            </div>
          </div>
          <div
            className='chat-header-subtitle chat-header-subtitle--debug'
            onDoubleClick={() => {
              // eslint-disable-next-line no-console
              console.log('Session Full Info:', {
                sessionId,
                sessionTitle,
                isStarred,
                isArchived,
                tags,
                lastMessage,
                lastUserMessage,
                sessionInfo
              })
            }}
          >
            {sessionId ?? t('chat.selectModel')}
          </div>
        </div>
      </div>

      <div className='chat-header-actions'>
        <Radio.Group
          className='chat-header-view-group'
          value={activeView}
          optionType='button'
          buttonStyle='solid'
          size='small'
          onChange={(event) => {
            onViewChange(event.target.value as ChatHeaderView)
          }}
          options={[
            {
              label: (
                <span className='chat-header-view-option material-symbols-rounded'>
                  forum
                </span>
              ),
              value: 'history'
            },
            {
              label: (
                <span className='chat-header-view-option material-symbols-rounded'>
                  timeline
                </span>
              ),
              value: 'timeline'
            },
            {
              label: (
                <span className='chat-header-view-option material-symbols-rounded'>
                  tune
                </span>
              ),
              value: 'settings'
            }
          ]}
        />
        <div className='chat-header-divider' />
        <Dropdown menu={{ items: moreItems }} placement='bottomRight' trigger={['click']}>
          <Button
            type='text'
            icon={<span className='material-symbols-rounded'>more_vert</span>}
          />
        </Dropdown>
      </div>
    </div>
  )
}

export function SessionSettingsPanel({
  sessionId,
  initialTitle,
  initialTags = [],
  sessionInfo,
  onClose
}: {
  sessionId: string
  initialTitle?: string
  initialTags?: string[]
  sessionInfo: SessionInfo | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { message, modal } = App.useApp()
  const fields = useMemo<FieldSpec[]>(() => [
    {
      path: ['title'],
      type: 'string',
      defaultValue: '',
      icon: 'edit_note',
      labelKey: 'chat.title',
      placeholderKey: 'chat.enterTitle'
    },
    {
      path: ['tags'],
      type: 'string[]',
      defaultValue: [],
      icon: 'sell',
      labelKey: 'chat.tags'
    }
  ], [])
  const initialValue = useMemo(() => ({
    title: initialTitle ?? '',
    tags: initialTags
  }), [initialTags, initialTitle])
  const [draft, setDraft] = useState(initialValue)
  const draftsRef = useRef(initialValue)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingRef = useRef(false)
  const lastSavedRef = useRef<string | null>(null)

  useEffect(() => {
    setDraft(initialValue)
  }, [initialValue])

  useEffect(() => {
    draftsRef.current = draft
  }, [draft])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  const toolGroups = useMemo(() => getSessionToolGroups(sessionInfo), [sessionInfo])
  const assetWarnings = useMemo(() => getSessionAssetWarnings(sessionInfo), [sessionInfo])
  const selectionWarnings = useMemo(() => getSessionSelectionWarnings(sessionInfo), [sessionInfo])

  const formatSelectionWarning = (warning: (typeof selectionWarnings)[number]) => {
    const reason = warning.reason === 'excluded'
      ? t('chat.selectionWarningReasonExcluded')
      : t('chat.selectionWarningReasonNotIncluded')

    return t('chat.selectionWarningFallback', {
      adapter: warning.adapter,
      requestedModel: warning.requestedModel,
      resolvedModel: warning.resolvedModel,
      reason
    })
  }

  const scheduleSave = (nextValue: { title: string; tags: string[] }) => {
    const serialized = JSON.stringify(nextValue ?? {})
    if (lastSavedRef.current === serialized) return
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }
    saveTimerRef.current = setTimeout(async () => {
      if (savingRef.current) return
      const currentValue = draftsRef.current
      const currentSerialized = JSON.stringify(currentValue ?? {})
      if (lastSavedRef.current === currentSerialized) return
      savingRef.current = true
      try {
        await updateSession(sessionId, {
          title: typeof currentValue.title === 'string' ? currentValue.title : '',
          tags: Array.isArray(currentValue.tags) ? currentValue.tags : []
        })
        lastSavedRef.current = currentSerialized
      } catch (err) {
        void message.error(getApiErrorMessage(err, t('common.operationFailed')))
      } finally {
        savingRef.current = false
      }
    }, 500)
  }

  const handleDraftChange = (nextValue: unknown) => {
    const nextRecord = (nextValue != null && typeof nextValue === 'object')
      ? nextValue as Record<string, unknown>
      : {}
    const nextDraft = {
      title: typeof nextRecord.title === 'string' ? nextRecord.title : '',
      tags: Array.isArray(nextRecord.tags)
        ? nextRecord.tags.filter(item => typeof item === 'string')
        : []
    }
    setDraft(nextDraft)
    scheduleSave(nextDraft)
  }

  const handleDelete = () => {
    modal.confirm({
      title: t('common.deleteSession'),
      content: t('common.deleteSessionConfirm'),
      okText: t('common.delete'),
      okType: 'danger',
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          await deleteSession(sessionId)
          void message.success(t('common.deleteSuccess'))
          onClose()
        } catch (err) {
          void message.error(getApiErrorMessage(err, t('common.deleteFailed')))
        }
      }
    })
  }

  return (
    <div className='session-settings-drawer'>
      <ConfigSectionPanel
        sectionKey='session'
        title={null}
        icon={undefined}
        fields={fields}
        value={draft}
        onChange={handleDraftChange}
        mergedModelServices={{}}
        mergedAdapters={{}}
        selectedModelService={undefined}
        t={t}
        className='session-settings-drawer__form'
      />

      <div className='settings-section session-runtime-section'>
        <div className='section-header'>
          <span className='material-symbols-rounded'>build</span>
          <span>{t('chat.availableTools')}</span>
        </div>

        {selectionWarnings.length > 0 && (
          <div className='session-info-note-list'>
            <div className='session-info-note-list__title'>{t('chat.selectionWarningsTitle')}</div>
            {selectionWarnings.map((warning, index) => (
              <div
                key={`${warning.adapter}:${warning.requestedModel}:${warning.resolvedModel}:${index}`}
                className='session-info-note session-info-note--warning'
              >
                <span className='material-symbols-rounded'>warning</span>
                <span>{formatSelectionWarning(warning)}</span>
              </div>
            ))}
          </div>
        )}

        {assetWarnings.length > 0 && (
          <div className='session-info-note-list'>
            <div className='session-info-note-list__title'>{t('chat.assetWarningsTitle')}</div>
            {assetWarnings.map((warning) => (
              <div key={warning.assetId} className='session-info-note'>
                <span className='material-symbols-rounded'>warning</span>
                <div className='session-info-note__content'>
                  <code>{warning.assetId}</code>
                  <span>{warning.reason}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {toolGroups.length > 0
          ? (
            <div className='session-tool-groups'>
              {toolGroups.map((group) => (
                <div key={group.key} className='session-tool-group-card'>
                  <div className='session-tool-group-card__header'>
                    <div className='session-tool-group-card__title'>
                      <span className='material-symbols-rounded'>{group.icon}</span>
                      <span>{t(group.labelKey)}</span>
                    </div>
                    <span className='session-tool-group-card__count'>{group.tools.length}</span>
                  </div>
                  <div className='session-tool-group-card__list'>
                    {group.tools.map(tool => (
                      <div key={tool} className='session-tool-chip'>
                        <span className='session-tool-chip__dot' />
                        <code>{formatToolLabel(tool)}</code>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
          : (
            <div className='session-settings-empty'>
              {t('chat.availableToolsEmpty')}
            </div>
          )}
      </div>

      <div className='settings-footer'>
        <div className='danger-zone'>
          <div className='delete-session-row'>
            <div className='delete-session-meta'>
              <div className='delete-session-title'>{t('chat.deleteSessionTitle')}</div>
              <div className='delete-session-desc'>{t('chat.deleteSessionDesc')}</div>
            </div>
            <Button
              danger
              type='primary'
              size='middle'
              icon={<span className='material-symbols-rounded'>delete_forever</span>}
              onClick={handleDelete}
              className='delete-session-btn'
            >
              {t('common.delete')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
