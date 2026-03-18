import './SessionRoute.scss'

import { Button, Empty } from 'antd'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import useSWR from 'swr'

import type { Session } from '@vibe-forge/core'

import { Chat } from '#~/components/Chat'

export function SessionRoute() {
  const { t } = useTranslation()
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { data: sessionsRes, isLoading } = useSWR<{ sessions: Session[] }>('/api/sessions')
  const session = sessionsRes?.sessions.find(item => item.id === sessionId)

  if (isLoading) {
    return null
  }

  if (session == null) {
    return (
      <div className='session-route__empty-state'>
        <Empty description={t('common.sessionNotFound')} />
        <Button type='primary' onClick={() => void navigate('/')}>{t('common.backToHome')}</Button>
      </div>
    )
  }

  return <Chat session={session} />
}
