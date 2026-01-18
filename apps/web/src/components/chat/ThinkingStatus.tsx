import './ThinkingStatus.scss'
import React from 'react'
import { useTranslation } from 'react-i18next'

export function ThinkingStatus() {
  const { t } = useTranslation()
  return (
    <div className="chat-thinking-status">
      <div className="dot-flashing"></div>
      <span>{t('chat.thinking')}</span>
    </div>
  )
}
