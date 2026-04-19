import { Button } from 'antd'
import type { PointerEvent } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ServerConnectionProfile } from '#~/server-connection-history'

import { ServerConnectionProfileModal } from './ServerConnectionProfileModal'

const blurActiveElement = () => {
  const activeElement = document.activeElement
  if (activeElement instanceof HTMLElement) {
    activeElement.blur()
  }
}

const hasAuthToken = (profile: ServerConnectionProfile) => (
  profile.authToken != null && profile.authToken.trim() !== ''
)

const getProfileTitle = (profile: ServerConnectionProfile) => (
  profile.alias?.trim() || profile.serverUrl
)

const getServerVersion = (profile: ServerConnectionProfile) => (
  profile.serverVersion?.trim()
)

const shouldConnectOnPointerDown = (event: PointerEvent<HTMLButtonElement>) => (
  event.pointerType === 'touch' || event.pointerType === 'pen'
)

export function ServerConnectionProfiles({
  profiles,
  submitting,
  onConnect,
  onProfilesChange
}: {
  profiles: ServerConnectionProfile[]
  submitting: boolean
  onConnect: (serverUrl: string) => void
  onProfilesChange: (profiles: ServerConnectionProfile[]) => void
}) {
  const { t } = useTranslation()
  const [editingProfile, setEditingProfile] = useState<ServerConnectionProfile | null>(null)

  if (profiles.length === 0) return null

  const handleProfilePointerDown = (
    event: PointerEvent<HTMLButtonElement>,
    profile: ServerConnectionProfile
  ) => {
    blurActiveElement()
    if (!shouldConnectOnPointerDown(event) || submitting) return
    event.preventDefault()
    onConnect(profile.serverUrl)
  }

  return (
    <section className='server-connection-gate__recent' aria-labelledby='server-connection-recent-title'>
      <h2 id='server-connection-recent-title'>{t('serverConnection.recentTitle')}</h2>
      <div className='server-connection-gate__recent-list'>
        {profiles.map(profile => (
          <div key={profile.serverUrl} className='server-connection-gate__profile-row'>
            <div
              className={`server-connection-gate__profile-card ${submitting ? 'is-disabled' : ''}`}
            >
              <button
                type='button'
                className='server-connection-gate__recent-item'
                disabled={submitting}
                onPointerDown={event => handleProfilePointerDown(event, profile)}
                onClick={() => onConnect(profile.serverUrl)}
              >
                <span className='material-symbols-rounded'>dns</span>
                <span className='server-connection-gate__profile-main'>
                  <span className='server-connection-gate__profile-title'>{getProfileTitle(profile)}</span>
                  <span className='server-connection-gate__profile-url'>{profile.serverUrl}</span>
                  <span className='server-connection-gate__profile-version'>
                    {t('serverConnection.serverVersion', {
                      version: getServerVersion(profile) ?? t('serverConnection.serverVersionUnknown')
                    })}
                  </span>
                  {profile.description != null && (
                    <span className='server-connection-gate__profile-description'>{profile.description}</span>
                  )}
                </span>
                <span className={`server-connection-gate__profile-auth ${hasAuthToken(profile) ? 'is-saved' : ''}`}>
                  {hasAuthToken(profile) ? t('serverConnection.loginSaved') : t('serverConnection.loginMissing')}
                </span>
              </button>
              <Button
                htmlType='button'
                type='text'
                className='server-connection-gate__profile-manage'
                icon={<span className='material-symbols-rounded'>edit</span>}
                aria-label={t('serverConnection.manageProfile')}
                onPointerDown={blurActiveElement}
                onClick={() => setEditingProfile(profile)}
              />
            </div>
          </div>
        ))}
      </div>

      <ServerConnectionProfileModal
        profile={editingProfile}
        onClose={() => setEditingProfile(null)}
        onProfilesChange={onProfilesChange}
      />
    </section>
  )
}
