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
  renderLeft
}: {
  sessionInfo: SessionInfo | null
  sessionId?: string
  sessionTitle?: string
  renderLeft?: React.ReactNode
}) {
  const { t } = useTranslation()
  const { mutate } = useSWRConfig()
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')

  const title = (sessionInfo?.type === 'init' ? sessionInfo.title : null) || sessionTitle
  const cwd = sessionInfo?.type === 'init' ? sessionInfo.cwd : null
  const displayTitle = title || t('common.newChat')

  useEffect(() => {
    if (title) {
      setEditTitle(title)
    }
  }, [title])

  const handleTitleSubmit = async () => {
    if (!sessionId || !editTitle.trim() || editTitle === title) {
      setIsEditing(false)
      return
    }

    try {
      await updateSessionTitle(sessionId, editTitle.trim())
      await mutate('/api/sessions')
      setIsEditing(false)
      message.success(t('chat.titleUpdated'))
    } catch (err) {
      message.error(t('chat.titleUpdateFailed'))
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
                onBlur={handleTitleSubmit}
                onPressEnter={handleTitleSubmit}
                autoFocus
                size='small'
                style={{ fontSize: '16px', fontWeight: 600, width: '100%', maxWidth: '400px' }}
              />
            )
            : (
              <div
                className='chat-header-title'
                onClick={() => sessionId && setIsEditing(true)}
                style={{ cursor: sessionId ? 'pointer' : 'default' }}
                title={sessionId ? t('chat.clickToEditTitle') : undefined}
              >
                {displayTitle}
              </div>
            )}
          <div className='chat-header-subtitle'>
            {cwd || t('chat.selectModel')}
          </div>
        </div>
      </div>

      {sessionId && (
        <div
          className='chat-header-session-id'
          onDoubleClick={() => {
            navigator.clipboard.writeText(sessionId)
            message.success('Session ID 已复制到剪贴板')
            console.log('[ChatHeader] Session Info:', {
              id: sessionId,
              title,
              cwd,
              sessionInfo
            })
          }}
          title='双击复制 Session ID 并打印详情'
        >
          {sessionId}
        </div>
      )}
    </div>
  )
}
