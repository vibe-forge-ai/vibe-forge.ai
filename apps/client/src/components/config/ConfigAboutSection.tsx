import './ConfigAboutSection.scss'

import type { AboutInfo } from '@vibe-forge/types'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getClientCommitHash, getClientVersion } from '#~/client-build-info'

export const AboutSection = ({ value }: { value?: AboutInfo }) => {
  const { t } = useTranslation()
  const [showCommitHash, setShowCommitHash] = useState(false)
  const aboutInfo = (value != null && typeof value === 'object')
    ? value
    : undefined
  const urls = aboutInfo?.urls
  const serverVersion = aboutInfo?.version
  const clientVersion = getClientVersion()
  const clientCommitHash = getClientCommitHash()
  const lastReleaseAt = aboutInfo?.lastReleaseAt

  return (
    <div className='config-about'>
      <div className='config-about__card'>
        <div className='config-about__app'>
          <div className='config-about__app-icon'>
            <span className='material-symbols-rounded'>auto_awesome</span>
          </div>
          <div className='config-about__app-info'>
            <div className='config-about__app-title'>
              {t('config.about.software')}
            </div>
            <div className='config-about__app-meta'>
              <span
                className='config-about__app-version'
                title={t('config.about.commitHash')}
                onDoubleClick={() => setShowCommitHash(true)}
              >
                {t('config.about.clientVersion')}: {clientVersion}
              </span>
              {showCommitHash && (
                <span className='config-about__app-commit'>
                  {t('config.about.commitHash')}: {clientCommitHash ?? t('config.about.unknown')}
                </span>
              )}
              <span className='config-about__app-server-version'>
                {t('config.about.serverVersion')}: {serverVersion ?? t('config.about.unknown')}
              </span>
              <span className='config-about__app-date'>
                {lastReleaseAt ?? t('config.about.unknown')}
              </span>
            </div>
          </div>
        </div>
        <a
          className='config-about__primary'
          href={urls?.releases ?? urls?.repo}
          target='_blank'
          rel='noreferrer'
        >
          {t('config.about.checkUpdate')}
        </a>
      </div>

      <div className='config-about__list'>
        <a
          className='config-about__item-row'
          href={urls?.docs ?? urls?.repo}
          target='_blank'
          rel='noreferrer'
        >
          <span className='config-about__item-left'>
            <span className='material-symbols-rounded config-about__item-icon'>menu_book</span>
            <span>{t('config.about.docs')}</span>
          </span>
          <span className='material-symbols-rounded config-about__arrow'>open_in_new</span>
        </a>
        <a
          className='config-about__item-row'
          href={urls?.contact ?? urls?.repo}
          target='_blank'
          rel='noreferrer'
        >
          <span className='config-about__item-left'>
            <span className='material-symbols-rounded config-about__item-icon'>mail</span>
            <span>{t('config.about.contact')}</span>
          </span>
          <span className='material-symbols-rounded config-about__arrow'>open_in_new</span>
        </a>
        <a
          className='config-about__item-row'
          href={urls?.issues ?? urls?.repo}
          target='_blank'
          rel='noreferrer'
        >
          <span className='config-about__item-left'>
            <span className='material-symbols-rounded config-about__item-icon'>bug_report</span>
            <span>{t('config.about.feedback')}</span>
          </span>
          <span className='material-symbols-rounded config-about__arrow'>open_in_new</span>
        </a>
      </div>
    </div>
  )
}
