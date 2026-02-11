import './ConfigView.scss'

import { Empty, Spin, Tabs } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'
import { getConfig } from '../api'

interface ConfigSection {
  general?: unknown
  conversation?: unknown
  modelServices?: unknown
  adapters?: unknown
  plugins?: unknown
  mcp?: unknown
}

interface AboutInfo {
  version?: string
  lastReleaseAt?: string
  urls?: {
    repo?: string
    docs?: string
    contact?: string
    issues?: string
    releases?: string
  }
}

interface ConfigResponse {
  sources?: {
    project?: ConfigSection
    user?: ConfigSection
    merged?: ConfigSection
  }
  meta?: {
    workspaceFolder?: string
    configPresent?: {
      project?: boolean
      user?: boolean
    }
    experiments?: unknown
    about?: AboutInfo
  }
}

const isEmptyValue = (value: unknown) => {
  if (value == null) return true
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length === 0
  return false
}

const ConfigSection = ({ value }: { value: unknown }) => {
  if (isEmptyValue(value)) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
  }

  return (
    <pre className='config-view__section'>
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

const AboutSection = ({ value }: { value?: AboutInfo }) => {
  const { t } = useTranslation()
  const aboutInfo = (value != null && typeof value === 'object')
    ? value
    : undefined
  const urls = aboutInfo?.urls
  const version = aboutInfo?.version
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
              <span className='config-about__app-version'>
                {t('config.about.version')}: {version ?? t('config.about.unknown')}
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

export function ConfigView() {
  const { t } = useTranslation()
  const { data, isLoading, error } = useSWR<ConfigResponse>('/api/config', getConfig)
  const [sourceKey, setSourceKey] = useState<'project' | 'user'>('project')
  const [activeTabKey, setActiveTabKey] = useState('general')
  const configPresent = data?.meta?.configPresent
  const currentSource = data?.sources?.[sourceKey]

  useEffect(() => {
    if (configPresent?.project) {
      setSourceKey('project')
    } else if (configPresent?.user) {
      setSourceKey('user')
    }
  }, [configPresent?.project, configPresent?.user])

  const tabs = useMemo(() => [
    { key: 'group-config', type: 'group', label: t('config.groups.config') },
    { key: 'general', icon: 'tune', label: t('config.sections.general'), value: currentSource?.general },
    {
      key: 'conversation',
      icon: 'forum',
      label: t('config.sections.conversation'),
      value: currentSource?.conversation
    },
    {
      key: 'modelServices',
      icon: 'model_training',
      label: t('config.sections.modelServices'),
      value: currentSource?.modelServices
    },
    {
      key: 'adapters',
      icon: 'settings_input_component',
      label: t('config.sections.adapters'),
      value: currentSource?.adapters
    },
    { key: 'plugins', icon: 'extension', label: t('config.sections.plugins'), value: currentSource?.plugins },
    { key: 'mcp', icon: 'account_tree', label: t('config.sections.mcp'), value: currentSource?.mcp },
    { key: 'group-app', type: 'group', label: t('config.groups.app') },
    { key: 'experiments', icon: 'science', label: t('config.sections.experiments'), value: data?.meta?.experiments },
    { key: 'about', icon: 'info', label: t('config.sections.about'), value: data?.meta?.about }
  ], [currentSource, data?.meta?.about, data?.meta?.experiments, t])

  const configTabKeys = new Set([
    'general',
    'conversation',
    'modelServices',
    'adapters',
    'plugins',
    'mcp'
  ])

  return (
    <div className='config-view'>
      {isLoading && (
        <div className='config-view__state'>
          <Spin />
        </div>
      )}
      {!isLoading && (error != null) && (
        <div className='config-view__state'>
          <Empty description={t('config.loadFailed')} />
        </div>
      )}
      {!isLoading && error == null && (
        <div className='config-view__tabs-wrap'>
          <Tabs
            tabPosition='left'
            tabBarGutter={0}
            indicator={{ size: 0 }}
            className='config-view__tabs'
            activeKey={activeTabKey}
            onChange={(key) => {
              if (key !== 'group-config' && key !== 'group-app') {
                setActiveTabKey(key)
              }
            }}
            items={tabs.map((tab) => {
              if (tab.type === 'group') {
                return {
                  key: tab.key,
                  label: <span className='config-view__group-label'>{tab.label}</span>,
                  disabled: true,
                  children: <div />
                }
              }
              return {
                key: tab.key,
                label: (
                  <span className='config-view__tab-label'>
                    <span className='material-symbols-rounded config-view__tab-icon'>{tab.icon}</span>
                    <span className='config-view__tab-text'>{tab.label}</span>
                  </span>
                ),
                children: (
                  <div className='config-view__content'>
                    {configTabKeys.has(tab.key) && (
                      <div className='config-view__content-header'>
                        <Tabs
                          className='config-view__source-tabs'
                          activeKey={sourceKey}
                          onChange={(key) => {
                            if (key === 'project' || key === 'user') {
                              setSourceKey(key)
                            }
                          }}
                          items={[
                            {
                              key: 'project',
                              label: t('config.sources.project'),
                              disabled: configPresent?.project !== true
                            },
                            {
                              key: 'user',
                              label: t('config.sources.user'),
                              disabled: configPresent?.user !== true
                            }
                          ]}
                        />
                      </div>
                    )}
                    {tab.key === 'about'
                      ? <AboutSection value={tab.value as AboutInfo | undefined} />
                      : <ConfigSection value={tab.value} />}
                  </div>
                )
              }
            })}
          />
        </div>
      )}
    </div>
  )
}
