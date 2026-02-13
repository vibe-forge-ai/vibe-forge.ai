import './ChatHeader.scss'
import type { SessionInfo } from '@vibe-forge/core'
import { App, Button, Dropdown, Input, Radio, Tag } from 'antd'
import type { MenuProps } from 'antd'
import { useAtomValue } from 'jotai'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSWRConfig } from 'swr'
import { deleteSession, updateSession } from '../../api'
import { isSidebarCollapsedAtom, isSidebarResizingAtom } from '../../store/index'

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
  const { mutate } = useSWRConfig()
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
  isStarred,
  isArchived,
  onClose
}: {
  sessionId: string
  initialTitle?: string
  initialTags?: string[]
  isStarred?: boolean
  isArchived?: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { message, modal } = App.useApp()
  const { mutate } = useSWRConfig()
  const [title, setTitle] = useState(initialTitle ?? '')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>(initialTags)

  const handleSaveTitle = async () => {
    if (title.trim() === (initialTitle ?? '')) return
    try {
      await updateSession(sessionId, { title: title.trim() })
      void message.success(t('chat.titleUpdated'))
    } catch (err) {
      void message.error(t('chat.titleUpdateFailed'))
    }
  }

  const handleAddTag = async () => {
    if (tagInput.trim() === '' || tags.includes(tagInput.trim())) return
    const newTags = [...tags, tagInput.trim()]
    try {
      await updateSession(sessionId, { tags: newTags })
      setTags(newTags)
      setTagInput('')
    } catch (err) {
      void message.error(t('common.operationFailed'))
    }
  }

  const handleRemoveTag = async (tagToRemove: string) => {
    const newTags = tags.filter(t => t !== tagToRemove)
    try {
      await updateSession(sessionId, { tags: newTags })
      setTags(newTags)
    } catch (err) {
      void message.error(t('common.operationFailed'))
    }
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
      <div className='settings-section'>
        <div className='section-header'>
          <span className='material-symbols-rounded'>edit_note</span>
          {t('chat.title')}
        </div>
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={() => {
            void handleSaveTitle()
          }}
          onPressEnter={() => {
            void handleSaveTitle()
          }}
          placeholder={t('chat.enterTitle')}
          variant='filled'
          size='large'
          className='settings-input'
        />
      </div>

      <div className='settings-section'>
        <div className='section-header'>
          <span className='material-symbols-rounded'>sell</span>
          {t('chat.tags')}
        </div>
        <div className='tag-input-container'>
          <Input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onPressEnter={() => {
              void handleAddTag()
            }}
            placeholder={t('chat.addTagPlaceholder')}
            variant='filled'
            size='large'
            className='settings-input'
          />
          <Button
            type='primary'
            size='large'
            className='add-tag-btn'
            icon={<span className='material-symbols-rounded'>add</span>}
            onClick={() => {
              void handleAddTag()
            }}
          />
        </div>
        <div className={`tags-list ${tags.length === 0 ? 'empty' : ''}`}>
          {tags.map(tag => (
            <Tag
              key={tag}
              closable
              onClose={(e) => {
                e.preventDefault()
                void handleRemoveTag(tag)
              }}
              className='settings-tag'
            >
              {tag}
            </Tag>
          ))}
          {tags.length === 0 && (
            <div className='empty-text'>{t('chat.noTags')}</div>
          )}
        </div>
      </div>

      <div className='settings-footer'>
        <div className='settings-section actions-section'>
          <div className='section-header'>
            <span className='material-symbols-rounded'>bolt</span>
            {t('common.actions')}
          </div>
          <div className='actions-grid'>
            <Button
              className={`action-card star-action ${isStarred ? 'active' : ''}`}
              onClick={() => {
                void (async () => {
                  await updateSession(sessionId, { isStarred: !isStarred })
                  void mutate(`/api/sessions`)
                })()
              }}
            >
              <span className={`material-symbols-rounded ${isStarred ? 'is-filled' : ''}`}>
                {isStarred ? 'star' : 'star_border'}
              </span>
              <span>{isStarred ? t('common.unstar') : t('common.star')}</span>
            </Button>

            <Button
              className={`action-card archive-action ${isArchived ? 'active' : ''}`}
              onClick={() => {
                void (async () => {
                  await updateSession(sessionId, { isArchived: !isArchived })
                  void mutate(`/api/sessions`)
                  onClose()
                })()
              }}
            >
              <span className='material-symbols-rounded'>
                {isArchived ? 'unarchive' : 'archive'}
              </span>
              <span>{isArchived ? t('common.restore') : t('common.archive')}</span>
            </Button>
          </div>
        </div>

        <div className='danger-zone'>
          <Button
            danger
            type='text'
            block
            size='large'
            icon={<span className='material-symbols-rounded'>delete</span>}
            onClick={handleDelete}
            className='delete-btn'
          >
            {t('common.deleteSession')}
          </Button>
        </div>
      </div>
    </div>
  )
}
