import './ChatHeader.scss'
import type { SessionInfo } from '@vibe-forge/core'
import { App, Button, Drawer, Dropdown, Input, Tag, Tooltip } from 'antd'
import type { MenuProps } from 'antd'
import { useAtomValue } from 'jotai'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSWRConfig } from 'swr'
import { deleteSession, updateSession } from '../../api'
import { isSidebarCollapsedAtom, isSidebarResizingAtom } from '../../store/index'

export function ChatHeader({
  sessionInfo,
  sessionId,
  sessionTitle,
  isStarred,
  isArchived,
  tags,
  lastMessage,
  lastUserMessage
}: {
  sessionInfo: SessionInfo | null
  sessionId?: string
  sessionTitle?: string
  isStarred?: boolean
  isArchived?: boolean
  tags?: string[]
  lastMessage?: string
  lastUserMessage?: string
}) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { mutate } = useSWRConfig()
  const isSidebarCollapsed = useAtomValue(isSidebarCollapsedAtom)
  const isResizing = useAtomValue(isSidebarResizingAtom)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
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
      icon: <span className='material-symbols-outlined' style={{ fontSize: '18px' }}>
        {isStarred ? 'star_half' : 'star'}
      </span>,
      onClick: () => {
        void handleToggleStar()
      }
    },
    {
      key: 'archive',
      label: isArchived ? t('common.restore') : t('common.archive'),
      icon: <span className='material-symbols-outlined' style={{ fontSize: '18px' }}>
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
          <div className='chat-header-subtitle'>
            <span className='material-symbols-outlined'>route</span>
            {cwd ?? t('chat.selectModel')}
          </div>
          <div className='chat-header-subtitle'>
            {sessionId ?? t('chat.selectModel')}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Tooltip title={t('common.settings')}>
          <Button
            type='text'
            icon={<span className='material-symbols-outlined'>settings</span>}
            onClick={() => setIsSettingsOpen(true)}
          />
        </Tooltip>

        <Dropdown menu={{ items: moreItems }} placement='bottomRight' trigger={['click']}>
          <Button
            type='text'
            icon={<span className='material-symbols-outlined'>more_vert</span>}
          />
        </Dropdown>
      </div>

      <Drawer
        title={t('chat.sessionSettings')}
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        width={360}
        styles={{
          body: { padding: '24px' }
        }}
      >
        <SessionSettings
          sessionId={sessionId!}
          initialTitle={title}
          initialTags={tags}
          isStarred={isStarred}
          isArchived={isArchived}
          onClose={() => setIsSettingsOpen(false)}
        />
      </Drawer>
    </div>
  )
}

function SessionSettings({
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
        <div className='section-header'>{t('chat.title')}</div>
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
        />
      </div>

      <div className='settings-section'>
        <div className='section-header'>{t('chat.tags')}</div>
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
          />
          <Button
            type='primary'
            ghost
            size='large'
            icon={<span className='material-symbols-outlined' style={{ fontSize: '20px' }}>add</span>}
            onClick={() => {
              void handleAddTag()
            }}
          />
        </div>
        <div className='tags-list'>
          {tags.map(tag => (
            <Tag
              key={tag}
              closable
              onClose={(e) => {
                e.preventDefault()
                void handleRemoveTag(tag)
              }}
              className='custom-tag'
            >
              {tag}
            </Tag>
          ))}
          {tags.length === 0 && (
            <div className='empty-tags'>{t('chat.noTags')}</div>
          )}
        </div>
      </div>

      <div className='settings-footer'>
        <div className='footer-actions'>
          <Tooltip title={isArchived ? t('common.restore') : t('common.archive')}>
            <Button
              danger={isArchived}
              className={`archive-btn ${isArchived ? 'action-active' : ''}`}
              icon={<span className='material-symbols-outlined'>{isArchived ? 'unarchive' : 'archive'}</span>}
              onClick={() => {
                void (async () => {
                  await updateSession(sessionId, { isArchived: !isArchived })
                  onClose()
                })()
              }}
            >
              {isArchived ? t('common.restore') : t('common.archive')}
            </Button>
          </Tooltip>
          <Tooltip title={isStarred ? t('common.unstar') : t('common.star')}>
            <Button
              type={isStarred ? 'primary' : 'default'}
              className={`star-btn ${isStarred ? 'action-active' : ''}`}
              icon={<span className='material-symbols-outlined'>{isStarred ? 'star_half' : 'star'}</span>}
              onClick={() => {
                void (async () => {
                  await updateSession(sessionId, { isStarred: !isStarred })
                })()
              }}
            >
              {isStarred ? t('common.unstar') : t('common.star')}
            </Button>
          </Tooltip>
        </div>
        <div className='danger-zone'>
          <Button
            danger
            type='text'
            block
            icon={<span className='material-symbols-outlined'>delete</span>}
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
