import './ChatHeader.scss'

import type { Session } from '@vibe-forge/core'
import type { SessionInfo } from '@vibe-forge/types'
import { App, Button, Dropdown, Tooltip } from 'antd'
import type { MenuProps } from 'antd'
import { useAtomValue } from 'jotai'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError, deleteSession, getApiErrorMessage, updateSession } from '../../api'
import { useQueryParams } from '../../hooks/useQueryParams'
import { isSidebarCollapsedAtom, isSidebarResizingAtom } from '../../store/index'
import { ConfigSectionPanel } from '../config'
import type { FieldSpec } from '../config/configSchema'
import { ChatGitControls } from './git-controls/ChatGitControls'
import {
  formatToolLabel,
  getSessionAssetWarnings,
  getSessionSelectionWarnings,
  getSessionToolGroups
} from './session-metadata'

export type ChatHeaderView = 'history' | 'timeline' | 'settings'

interface SessionDebugItem {
  icon: string
  key: string
  label: string
  value: string
}

const DEBUG_MONO_KEYS = new Set([
  'sessionId',
  'uuid',
  'leafUuid',
  'adapter',
  'model',
  'version',
  'cwd'
])

export function ChatHeader({
  sessionInfo,
  sessionId,
  sessionTitle,
  isStarred,
  isArchived,
  tags,
  lastMessage,
  lastUserMessage,
  activeView,
  isTerminalOpen,
  onViewChange,
  onToggleTerminal
}: {
  sessionInfo: SessionInfo | null
  sessionId?: string
  sessionTitle?: string
  isStarred?: boolean
  isArchived?: boolean
  tags?: string[]
  lastMessage?: string
  lastUserMessage?: string
  activeView: ChatHeaderView
  isTerminalOpen: boolean
  onViewChange: (view: ChatHeaderView) => void
  onToggleTerminal: () => void
}) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const isSidebarCollapsed = useAtomValue(isSidebarCollapsedAtom)
  const isResizing = useAtomValue(isSidebarResizingAtom)
  const { searchParams, update: updateQuery } = useQueryParams<{ debug: string }>({
    keys: ['debug'],
    omit: {
      debug: value => value === ''
    }
  })
  const titleClickCountRef = useRef(0)
  const titleClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasDebugQuery = searchParams.has('debug')
  const isDebugMode = searchParams.get('debug') === 'true'
  const shouldShowDebugButton = hasDebugQuery

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
  const toggleDebugMode = () => {
    updateQuery({ debug: isDebugMode ? 'false' : 'true' })
  }

  const viewItems = [
    { value: 'history' as const, icon: 'forum', title: t('chat.viewHistory') },
    { value: 'timeline' as const, icon: 'timeline', title: t('chat.viewTimeline') },
    { value: 'settings' as const, icon: 'tune', title: t('chat.viewSettings') }
  ]

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
      icon: <span className={`material-symbols-rounded chat-header-icon ${isStarred ? 'is-filled' : ''}`}>
        {isStarred ? 'star' : 'star_border'}
      </span>,
      onClick: () => {
        void handleToggleStar()
      }
    },
    {
      key: 'archive',
      label: isArchived ? t('common.restore') : t('common.archive'),
      icon: <span className='material-symbols-rounded chat-header-icon'>
        {isArchived ? 'unarchive' : 'archive'}
      </span>,
      onClick: () => {
        void handleToggleArchive()
      }
    }
  ]

  useEffect(() => {
    return () => {
      if (titleClickTimerRef.current != null) {
        clearTimeout(titleClickTimerRef.current)
      }
    }
  }, [])

  const handleTitleClick = () => {
    if (titleClickTimerRef.current != null) {
      clearTimeout(titleClickTimerRef.current)
    }

    titleClickCountRef.current += 1

    if (titleClickCountRef.current >= 5) {
      titleClickCountRef.current = 0
      titleClickTimerRef.current = null
      toggleDebugMode()
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
      return
    }

    titleClickTimerRef.current = setTimeout(() => {
      titleClickCountRef.current = 0
      titleClickTimerRef.current = null
    }, 500)
  }

  return (
    <div className={`chat-header ${isSidebarCollapsed ? 'is-collapsed' : ''} ${isResizing ? 'is-resizing' : ''}`}>
      <div className='chat-header-main'>
        <div className='chat-header-info'>
          <div
            className='chat-header-title'
            onClick={handleTitleClick}
          >
            {displayTitle}
          </div>
        </div>
      </div>

      <div className='chat-header-actions'>
        {sessionId != null && sessionId !== '' && (
          <ChatGitControls sessionId={sessionId} />
        )}
        {viewItems.map(item => (
          <Tooltip key={item.value} title={item.title}>
            <Button
              type='text'
              className={`chat-header-action-button ${activeView === item.value ? 'is-active' : ''}`}
              title={item.title}
              aria-label={item.title}
              onClick={() => {
                onViewChange(item.value)
              }}
              icon={<span className='chat-header-view-option material-symbols-rounded'>{item.icon}</span>}
            />
          </Tooltip>
        ))}
        <Tooltip title={t('chat.viewTerminal')}>
          <Button
            type='text'
            className={`chat-header-action-button ${isTerminalOpen ? 'is-active' : ''}`}
            title={t('chat.viewTerminal')}
            aria-label={t('chat.viewTerminal')}
            onClick={onToggleTerminal}
            icon={<span className='chat-header-view-option material-symbols-rounded'>terminal</span>}
          />
        </Tooltip>
        {shouldShowDebugButton && (
          <Tooltip title={isDebugMode ? t('chat.debugDisable') : t('chat.debugEnable')}>
            <Button
              type='text'
              className={`chat-header-action-button ${isDebugMode ? 'is-debug-active' : ''}`}
              title={isDebugMode ? t('chat.debugDisable') : t('chat.debugEnable')}
              aria-label={isDebugMode ? t('chat.debugDisable') : t('chat.debugEnable')}
              onClick={toggleDebugMode}
              icon={<span className='chat-header-view-option material-symbols-rounded'>bug_report</span>}
            />
          </Tooltip>
        )}
        <Tooltip title={t('common.moreActions')}>
          <Dropdown menu={{ items: moreItems }} placement='bottomRight' trigger={['click']}>
            <Button
              type='text'
              className='chat-header-action-button'
              title={t('common.moreActions')}
              aria-label={t('common.moreActions')}
              icon={<span className='chat-header-view-option material-symbols-rounded'>more_vert</span>}
            />
          </Dropdown>
        </Tooltip>
      </div>
    </div>
  )
}

export function SessionSettingsPanel({
  session,
  sessionInfo,
  onClose
}: {
  session: Session
  sessionInfo: SessionInfo | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { message, modal } = App.useApp()
  const { searchParams } = useQueryParams<{ debug: string }>({ keys: ['debug'] })
  const isDebugMode = searchParams.get('debug') === 'true'
  const sessionId = session.id
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
    title: session.title ?? '',
    tags: session.tags ?? []
  }), [session.tags, session.title])
  const [draft, setDraft] = useState(initialValue)
  const [collapsedToolGroupKeys, setCollapsedToolGroupKeys] = useState<Record<string, boolean>>({})
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
  const debugItems = useMemo<SessionDebugItem[]>(() => {
    const emptyValue = t('chat.timelineEmptyValue')
    const booleanValue = (value: boolean | undefined) =>
      value ? t('chat.debugEnabledValue') : t('chat.debugDisabledValue')
    const tags = session.tags ?? []
    const items: SessionDebugItem[] = [
      {
        key: 'sessionId',
        label: t('chat.debugSessionId'),
        value: session.id,
        icon: 'fingerprint'
      },
      {
        key: 'view',
        label: t('chat.debugView'),
        value: t('chat.viewSettings'),
        icon: 'tune'
      },
      {
        key: 'starred',
        label: t('chat.debugStarred'),
        value: booleanValue(session.isStarred),
        icon: 'star'
      },
      {
        key: 'archived',
        label: t('chat.debugArchived'),
        value: booleanValue(session.isArchived),
        icon: 'archive'
      }
    ]

    if (tags.length > 0) {
      items.push({
        key: 'tags',
        label: t('chat.debugTags'),
        value: tags.join(', '),
        icon: 'sell'
      })
    }

    if (sessionInfo?.type === 'init') {
      items.push(
        {
          key: 'type',
          label: t('chat.debugType'),
          value: sessionInfo.type,
          icon: 'deployed_code'
        },
        {
          key: 'uuid',
          label: t('chat.debugUuid'),
          value: sessionInfo.uuid,
          icon: 'tag'
        },
        {
          key: 'adapter',
          label: t('chat.debugAdapter'),
          value: sessionInfo.adapter ?? emptyValue,
          icon: 'extension'
        },
        {
          key: 'model',
          label: t('chat.debugModel'),
          value: sessionInfo.model,
          icon: 'model_training'
        },
        {
          key: 'effort',
          label: t('chat.debugEffort'),
          value: sessionInfo.effort ?? emptyValue,
          icon: 'psychology'
        },
        {
          key: 'version',
          label: t('chat.debugVersion'),
          value: sessionInfo.version,
          icon: 'deployed_code_update'
        },
        {
          key: 'tools',
          label: t('chat.debugTools'),
          value: String(sessionInfo.tools.length),
          icon: 'handyman'
        },
        {
          key: 'agents',
          label: t('chat.debugAgents'),
          value: String(sessionInfo.agents.length),
          icon: 'hub'
        },
        {
          key: 'cwd',
          label: t('chat.debugCwd'),
          value: sessionInfo.cwd,
          icon: 'folder_open'
        }
      )
    }

    if (sessionInfo?.type === 'summary') {
      items.push(
        {
          key: 'type',
          label: t('chat.debugType'),
          value: sessionInfo.type,
          icon: 'deployed_code'
        },
        {
          key: 'leafUuid',
          label: t('chat.debugLeafUuid'),
          value: sessionInfo.leafUuid,
          icon: 'call_split'
        }
      )
    }
    return items
  }, [session.id, session.isArchived, session.isStarred, session.tags, sessionInfo, t])

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
    const runDelete = async (force = false) => {
      await deleteSession(sessionId, { force })
      void message.success(t('common.deleteSuccess'))
      onClose()
    }

    modal.confirm({
      title: t('common.deleteSession'),
      content: t('common.deleteSessionConfirm'),
      okText: t('common.delete'),
      okType: 'danger',
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          await runDelete()
        } catch (err) {
          if (err instanceof ApiError && err.code === 'session_worktree_not_clean') {
            modal.confirm({
              title: t('chat.sessionWorkspaceForceDeleteTitle'),
              content: t('chat.sessionWorkspaceForceDeleteDescription'),
              okText: t('common.delete'),
              okType: 'danger',
              cancelText: t('common.cancel'),
              onOk: async () => {
                try {
                  await runDelete(true)
                } catch (forceError) {
                  void message.error(getApiErrorMessage(forceError, t('common.deleteFailed')))
                }
              }
            })
            return
          }
          void message.error(getApiErrorMessage(err, t('common.deleteFailed')))
        }
      }
    })
  }

  const toggleToolGroup = (key: string) => {
    setCollapsedToolGroupKeys((prev) => ({
      ...prev,
      [key]: !prev[key]
    }))
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
                  <button
                    type='button'
                    className='session-tool-group-card__header'
                    onClick={() => toggleToolGroup(group.key)}
                  >
                    <div className='session-tool-group-card__title'>
                      <span className='material-symbols-rounded'>{group.icon}</span>
                      <span>{t(group.labelKey)}</span>
                    </div>
                    <div className='session-tool-group-card__meta'>
                      <span className='session-tool-group-card__count'>{group.tools.length}</span>
                      <span className='material-symbols-rounded session-tool-group-card__expand'>
                        {collapsedToolGroupKeys[group.key] ? 'expand_more' : 'expand_less'}
                      </span>
                    </div>
                  </button>
                  {!collapsedToolGroupKeys[group.key] && (
                    <div className='session-tool-group-card__list'>
                      {group.tools.map(tool => (
                        <div key={tool} className='session-tool-row' title={formatToolLabel(tool)}>
                          <span className='session-tool-row__dot' />
                          <code>{formatToolLabel(tool)}</code>
                        </div>
                      ))}
                    </div>
                  )}
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

      {isDebugMode && debugItems.length > 0 && (
        <div className='settings-section session-debug-section'>
          <div className='section-header'>
            <span className='material-symbols-rounded'>bug_report</span>
            <span>{t('chat.debugSectionTitle')}</span>
          </div>

          <div className='session-debug-panel'>
            <div className='session-debug-list'>
              {debugItems.map(item => (
                <div key={item.key} className='session-debug-row'>
                  <span className='session-debug-row__label'>{item.label}</span>
                  <span
                    className={`session-debug-row__value ${DEBUG_MONO_KEYS.has(item.key) ? 'is-mono' : ''}`}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
