import './ChatHeader.scss'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { message } from 'antd'
import type { SessionInfo } from '#~/types'

export function ChatHeader({ 
  sessionInfo,
  sessionId,
  renderLeft
}: { 
  sessionInfo: SessionInfo | null,
  sessionId?: string,
  renderLeft?: React.ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="chat-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {renderLeft}
        <div 
          className="chat-header-info" 
          onDoubleClick={() => {
            console.log('[ChatHeader] Session Initialization Info:', sessionInfo);
          }}
          style={{ cursor: 'pointer', userSelect: 'none' }}
          title={t('chat.viewInitInfo')}
        >
          <div className="chat-header-title">
            {sessionInfo ? t('chat.sessionActive') : t('common.newChat')}
          </div>
          <div className="chat-header-subtitle">
            {sessionInfo?.cwd || t('chat.selectModel')}
          </div>
        </div>
      </div>

      {sessionId && (
        <div 
          className="chat-header-session-id"
          onDoubleClick={() => {
            navigator.clipboard.writeText(sessionId)
            message.success('Session ID 已复制到剪贴板')
          }}
          title="双击复制 Session ID"
        >
          {sessionId}
        </div>
      )}
    </div>
  )
}
