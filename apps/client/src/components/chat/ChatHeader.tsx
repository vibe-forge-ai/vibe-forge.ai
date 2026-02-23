import './ChatHeader.scss'

import type { SessionInfo } from '@vibe-forge/core'
import { App, Button, Dropdown, Radio } from 'antd'
import type { MenuProps } from 'antd'
import { useAtomValue } from 'jotai'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { deleteSession, updateSession } from '../../api'
import { isSidebarCollapsedAtom, isSidebarResizingAtom } from '../../store/index'
import { ConfigSectionPanel } from '../config'
import type { FieldSpec } from '../config/configSchema'

export type ChatHeaderView = 'history' | 'timeline' | 'settings'

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
  onViewChange
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
  onViewChange: (view: ChatHeaderView) => void
}) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const isSidebarCollapsed = useAtomValue(isSidebarCollapsedAtom)
  const isResizing = useAtomValue(isSidebarResizingAtom)
  const [editTitle, setEditTitle] = useState('')

  const summary = sessionInfo?.type === 'summary' ? sessionInfo.summary : null
  const title = (sessionInfo?.type === 'init' ? sessionInfo.title : null) ?? sessionTitle
  const cwd = sessionInfo?.type === 'init' ? sessionInfo.cwd : null
  const displayTitle = (title != null && title !== '')
    ? title
    : (summary != null && summary !== '')
    ? summary
    : (lastUserMessage != null && lastUserMessage !== '')
    ? lastUserMessage
    : (lastMessage != null && lastMessage !== '')
    ? lastMessage
    : t('common.newChat')

  useEffect(() => {
    if (title != null && title !== '') {
      setEditTitle(title)
    }
  }, [title])

  const handleToggleStar = async () => {
    if (sessionId == null || sessionId === '') return
    try {
      await updateSession(sessionId, { isStarred: !isStarred })
      void message.success(isStarred ? t('common.unstarred') : t('common.starred'))
    } catch (err) {
      void message.error(t('common.operationFailed'))
    }
  }

  const handleToggleArchive = async () => {
    if (sessionId == null || sessionId === '') return
    try {
      await updateSession(sessionId, { isArchived: !isArchived })
      void message.success(isArchived ? t('common.restored') : t('common.archived'))
    } catch (err) {
      void message.error(t('common.operationFailed'))
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
        <div className='chat-header-info'>
          <div className='chat-header-title'>
            {displayTitle}
          </div>
          <div
            className='chat-header-subtitle'
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
            style={{ cursor: 'pointer', userSelect: 'all' }}
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
                <span className='chat-header-view-option'>
                  <span className='material-symbols-rounded'>forum</span>
                  <span>{t('chat.viewHistory')}</span>
                </span>
              ),
              value: 'history'
            },
            {
              label: (
                <span className='chat-header-view-option'>
                  <span className='material-symbols-rounded'>timeline</span>
                  <span>{t('chat.viewTimeline')}</span>
                </span>
              ),
              value: 'timeline'
            },
            {
              label: (
                <span className='chat-header-view-option'>
                  <span className='material-symbols-rounded'>tune</span>
                  <span>{t('chat.viewSettings')}</span>
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
  onClose
}: {
  sessionId: string
  initialTitle?: string
  initialTags?: string[]
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
      } catch {
        void message.error(t('common.operationFailed'))
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
          void message.error(t('common.deleteFailed'))
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
