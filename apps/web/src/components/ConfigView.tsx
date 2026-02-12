import './ConfigView.scss'

import { App, Empty, Radio, Space, Spin, Tabs } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import type { AboutInfo, ConfigResponse, ConfigSource } from '@vibe-forge/core'

import { getConfig, updateConfig } from '../api'
import { AboutSection } from './config/ConfigAboutSection'
import { DisplayValue } from './config/ConfigDisplayValue'
import { SectionForm } from './config/ConfigSectionForm'
import { cloneValue, getValueByPath, isEmptyValue } from './config/configUtils'

export function ConfigView() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { data, isLoading, error, mutate } = useSWR<ConfigResponse>('/api/config', getConfig)
  const [sourceKey, setSourceKey] = useState<ConfigSource>('project')
  const [activeTabKey, setActiveTabKey] = useState('general')
  const [drafts, setDrafts] = useState<Record<string, unknown>>({})
  const configPresent = data?.meta?.configPresent
  const currentSource = data?.sources?.[sourceKey]
  const draftsRef = useRef<Record<string, unknown>>(drafts)
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const savingRef = useRef<Record<string, boolean>>({})
  const lastSavedRef = useRef<Record<string, string>>({})
  const mergedModelServices = useMemo(() => data?.sources?.merged?.modelServices ?? {}, [
    data?.sources?.merged?.modelServices
  ])

  useEffect(() => {
    if (configPresent?.project) {
      setSourceKey('project')
    } else if (configPresent?.user) {
      setSourceKey('user')
    }
  }, [configPresent?.project, configPresent?.user])

  const configTabKeys = useMemo(() =>
    new Set([
      'general',
      'conversation',
      'modelServices',
      'adapters',
      'plugins',
      'mcp',
      'shortcuts'
    ]), [])

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
    { key: 'shortcuts', icon: 'keyboard', label: t('config.sections.shortcuts'), value: currentSource?.shortcuts },
    { key: 'group-app', type: 'group', label: t('config.groups.app') },
    { key: 'experiments', icon: 'science', label: t('config.sections.experiments'), value: data?.meta?.experiments },
    { key: 'about', icon: 'info', label: t('config.sections.about'), value: data?.meta?.about }
  ], [currentSource, data?.meta?.about, data?.meta?.experiments, t])

  const activeTab = useMemo(() => tabs.find(tab => tab.key === activeTabKey), [tabs, activeTabKey])

  useEffect(() => {
    if (activeTab == null) return
    if (!configTabKeys.has(activeTab.key)) return
    const draftKey = `${sourceKey}:${activeTab.key}`
    setDrafts((prev) => {
      const currentDraft = prev[draftKey]
      const sourceValue = activeTab.value ?? {}
      if (currentDraft !== undefined) {
        if (isEmptyValue(currentDraft) && !isEmptyValue(sourceValue)) {
          return { ...prev, [draftKey]: cloneValue(sourceValue) }
        }
        return prev
      }
      return { ...prev, [draftKey]: cloneValue(sourceValue) }
    })
  }, [activeTab, configTabKeys, sourceKey])

  useEffect(() => {
    draftsRef.current = drafts
  }, [drafts])

  useEffect(() => {
    return () => {
      Object.values(saveTimersRef.current).forEach((timer) => {
        clearTimeout(timer)
      })
    }
  }, [])

  const getDraftKey = (sectionKey: string, source = sourceKey) => `${source}:${sectionKey}`
  const generalDraftValue = useMemo(() => {
    const draftKey = getDraftKey('general')
    return (drafts[draftKey] ?? cloneValue(currentSource?.general ?? {}) ?? {}) as Record<string, unknown>
  }, [drafts, currentSource?.general, sourceKey])
  const selectedModelService = (() => {
    const value = getValueByPath(generalDraftValue, ['defaultModelService'])
    return typeof value === 'string' ? value : undefined
  })()

  const scheduleSave = (sectionKey: string, source: ConfigSource, nextValue: unknown) => {
    const draftKey = getDraftKey(sectionKey, source)
    const serialized = JSON.stringify(nextValue ?? {})
    if (lastSavedRef.current[draftKey] === serialized) {
      return
    }
    if (saveTimersRef.current[draftKey]) {
      clearTimeout(saveTimersRef.current[draftKey])
    }
    saveTimersRef.current[draftKey] = setTimeout(async () => {
      if (savingRef.current[draftKey]) return
      const currentValue = draftsRef.current[draftKey] ?? nextValue
      const currentSerialized = JSON.stringify(currentValue ?? {})
      if (lastSavedRef.current[draftKey] === currentSerialized) return
      savingRef.current[draftKey] = true
      try {
        await updateConfig(source, sectionKey, currentValue)
        lastSavedRef.current[draftKey] = currentSerialized
        await mutate()
      } catch {
        void message.error(t('config.saveFailed'))
      } finally {
        savingRef.current[draftKey] = false
      }
    }, 800)
  }

  const handleDraftChange = (sectionKey: string, nextValue: unknown) => {
    const draftKey = getDraftKey(sectionKey)
    setDrafts(prev => ({ ...prev, [draftKey]: nextValue }))
    scheduleSave(sectionKey, sourceKey, nextValue)
  }

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
                    {tab.key === 'about' && (
                      <AboutSection value={tab.value as AboutInfo | undefined} />
                    )}
                    {tab.key !== 'about' && !configTabKeys.has(tab.key) && (
                      <DisplayValue value={tab.value} sectionKey={tab.key} t={t} />
                    )}
                    {configTabKeys.has(tab.key) && (
                      <div className='config-view__editor-wrap'>
                        <div className='config-view__section-header'>
                          <div className='config-view__section-title'>
                            <span className='material-symbols-rounded config-view__section-icon'>
                              {tab.icon}
                            </span>
                            <span>{tab.label}</span>
                          </div>
                          <Space size={12}>
                            <Radio.Group
                              value={sourceKey}
                              optionType='button'
                              buttonStyle='solid'
                              size='small'
                              onChange={(event) => {
                                const value = event.target.value as ConfigSource
                                setSourceKey(value)
                              }}
                              options={[
                                {
                                  label: (
                                    <span className='config-view__source-option'>
                                      <span className='material-symbols-rounded'>folder</span>
                                      <span>
                                        {configPresent?.project === true
                                          ? t('config.sources.project')
                                          : t('config.sources.projectMissing')}
                                      </span>
                                    </span>
                                  ),
                                  value: 'project'
                                },
                                {
                                  label: (
                                    <span className='config-view__source-option'>
                                      <span className='material-symbols-rounded'>person</span>
                                      <span>
                                        {configPresent?.user === true
                                          ? t('config.sources.user')
                                          : t('config.sources.userMissing')}
                                      </span>
                                    </span>
                                  ),
                                  value: 'user'
                                }
                              ]}
                            />
                          </Space>
                        </div>
                        <div className='config-view__card'>
                          <SectionForm
                            sectionKey={tab.key}
                            value={drafts[getDraftKey(tab.key)] ?? cloneValue(tab.value ?? {}) ?? {}}
                            onChange={(next) => handleDraftChange(tab.key, next)}
                            mergedModelServices={mergedModelServices as Record<string, unknown>}
                            selectedModelService={selectedModelService}
                            t={t}
                          />
                        </div>
                      </div>
                    )}
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
