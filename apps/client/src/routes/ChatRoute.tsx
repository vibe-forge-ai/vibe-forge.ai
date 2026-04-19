import './ChatRoute.scss'

import { Button, Empty } from 'antd'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import useSWR from 'swr'

import type { Session } from '@vibe-forge/core'

import { listSessions } from '#~/api'

import { ChatRouteView } from './ChatRouteView'

export function ChatRoute() {
  const { t } = useTranslation()
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { data: sessionsRes, isLoading } = useSWR<{ sessions: Session[] }>(
    sessionId ? '/api/sessions' : null,
    () => listSessions('active')
  )
  const session = sessionId == null ? undefined : sessionsRes?.sessions.find(item => item.id === sessionId)
  if (sessionId != null && isLoading) return null
  if (sessionId != null && session == null) {
    return (
      <div className='chat-route__empty-state'>
        <Empty description={t('common.sessionNotFound')} />
        <Button type='primary' onClick={() => void navigate('/')}>{t('common.backToHome')}</Button>
      </div>
    )
  }

  return <ChatRouteView session={session} />
}
