import './ChatHeader.scss'
import type { SessionInfo } from '@vibe-forge/core'
import { Input, message } from 'antd'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSWRConfig } from 'swr'
import { updateSessionTitle } from '../../api'

export function ChatHeader({
  sessionInfo,
  sessionId,
  sessionTitle,
  lastMessage,
  renderLeft
}: {
  sessionInfo: SessionInfo | null
  sessionId?: string
  sessionTitle?: string
  lastMessage?: string
  renderLeft?: React.ReactNode
}) {
  const { t } = useTranslation()
  const { mutate } = useSWRConfig()
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')

  const summary = sessionInfo?.type === 'summary' ? sessionInfo.summary : null
  const title = (sessionInfo?.type === 'init' ? sessionInfo.title : null) ?? sessionTitle
  const cwd = sessionInfo?.type === 'init' ? sessionInfo.cwd : null
  const displayTitle = (title != null && title !== '')
    ? title
    : (summary != null && summary !== '')
    ? summary
    : (lastMessage != null && lastMessage !== '')
    ? lastMessage
    : t('common.newChat')

  useEffect(() => {
    if (title != null && title !== '') {
      setEditTitle(title)
    }
  }, [title])

  const handleTitleSubmit = async () => {
    if (sessionId == null || sessionId === '' || editTitle.trim() === '' || editTitle === title) {
      setIsEditing(false)
      return
    }

    try {
      await updateSessionTitle(sessionId, editTitle.trim())
      await mutate('/api/sessions')
      setIsEditing(false)
      void message.success(t('chat.titleUpdated'))
    } catch (err) {
      void message.error(t('chat.titleUpdateFailed'))
    }
  }

  return (
    <div className='chat-header'>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
        {renderLeft}
        <div
          className='chat-header-info'
          style={{ flex: 1, minWidth: 0 }}
        >
          {isEditing
            ? (
              <Input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                onBlur={() => {
                  void handleTitleSubmit()
                }}
                onPressEnter={() => {
                  void handleTitleSubmit()
                }}
                autoFocus
                size='small'
                style={{ fontSize: '16px', fontWeight: 600, width: '100%', maxWidth: '400px' }}
              />
            )
            : (
              <div
                className='chat-header-title'
                onClick={() => (sessionId != null && sessionId !== '') && setIsEditing(true)}
                style={{ cursor: (sessionId != null && sessionId !== '') ? 'pointer' : 'default' }}
                title={(sessionId != null && sessionId !== '') ? t('chat.clickToEditTitle') : undefined}
              >
                {displayTitle}
              </div>
            )}
          <div className='chat-header-subtitle'>
            {cwd ?? t('chat.selectModel')}
          </div>
        </div>
      </div>

      {(sessionId != null && sessionId !== '') && (
        <div
          className='chat-header-session-id'
          onDoubleClick={() => {
            void navigator.clipboard.writeText(sessionId)
            void message.success(t('common.sessionIdCopied'))
          }}
          title={t('common.doubleClickToCopy')}
        >
          {sessionId}
        </div>
      )}
    </div>
  )
}
