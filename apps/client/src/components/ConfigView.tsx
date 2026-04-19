import './ConfigView.scss'

import { App, Empty, Select, Space, Spin, Tabs } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import type { ConfigSource } from '@vibe-forge/core'
import type { AboutInfo, ConfigResponse, ConfigUiSection } from '@vibe-forge/types'

import { PageShell } from '#~/components/layout/PageShell'
import { useResponsiveLayout } from '#~/hooks/use-responsive-layout'

import { getApiErrorMessage, getConfig, getConfigSchema, listWorktreeEnvironments, updateConfig } from '../api'
import { useQueryParams } from '../hooks/useQueryParams'
import { AboutSection, ConfigSectionPanel, ConfigSourceSwitch, DisplayValue } from './config'
import { AppSettingsPanel } from './config/AppSettingsPanel'
import { WorktreeEnvironmentPanel } from './config/WorktreeEnvironmentPanel'
import { cloneValue, getValueByPath, isEmptyValue } from './config/configUtils'
import { toDisplayEnvironmentName, toEnvironmentReference } from './config/worktree-environment-panel-model'

export function ConfigView() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { isCompactLayout, isTouchInteraction } = useResponsiveLayout()
  const { data, isLoading, error, mutate } = useSWR<ConfigResponse>('/api/config', getConfig)
  const { data: schemaData } = useSWR('/api/config/schema', getConfigSchema)
  const { data: worktreeEnvironmentData } = useSWR('worktree-environments', listWorktreeEnvironments)
  const { values: queryValues, update: updateQuery, searchParams } = useQueryParams<{
    tab: string
    source: string
    detail: string
  }>({
    keys: ['tab', 'source', 'detail'],
    defaults: { tab: 'general', source: 'project', detail: '' },
    omit: {
      detail: value => value.trim() === ''
    }
  })
  const querySourceKey: ConfigSource = queryValues.source === 'user' ? 'user' : 'project'
  const [sourceKey, setSourceKeyState] = useState<ConfigSource>(querySourceKey)
  const [detailQuery, setDetailQueryState] = useState(queryValues.detail)
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
  const mergedAdapters = useMemo(() => data?.sources?.merged?.adapters ?? {}, [
    data?.sources?.merged?.adapters
  ])

  useEffect(() => {
    if (searchParams.get('source') != null) return
    if (configPresent?.project) {
      updateQuery({ source: 'project' })
    } else if (configPresent?.user) {
      updateQuery({ source: 'user' })
    }
  }, [configPresent?.project, configPresent?.user])

  const configTabKeys = useMemo(() =>
    new Set([
      'general',
      'conversation',
      'models',
      'modelServices',
      'channels',
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
      key: 'worktreeEnvironments',
      icon: 'deployed_code',
      label: t('config.sections.environments')
    },
    {
      key: 'models',
      icon: 'tune',
      label: t('config.sections.models'),
      value: currentSource?.models
    },
    {
      key: 'modelServices',
      icon: 'model_training',
      label: t('config.sections.modelServices'),
      value: currentSource?.modelServices
    },
    {
      key: 'channels',
      icon: 'campaign',
      label: t('config.sections.channels'),
      value: currentSource?.channels
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
    { key: 'appearance', icon: 'tune', label: t('config.sections.appearance') },
    { key: 'experiments', icon: 'science', label: t('config.sections.experiments'), value: data?.meta?.experiments },
    { key: 'about', icon: 'info', label: t('config.sections.about'), value: data?.meta?.about }
  ], [currentSource, data?.meta?.about, data?.meta?.experiments, t])
  const tabKeys = useMemo(() => new Set(tabs.filter(tab => tab.type !== 'group').map(tab => tab.key)), [tabs])

  const queryTabKey = tabKeys.has(queryValues.tab) ? queryValues.tab : 'general'
  const [activeTabKey, setActiveTabKeyState] = useState(queryTabKey)
  const setSourceKey = (next: ConfigSource) => {
    setSourceKeyState(next)
    updateQuery({ source: next })
  }
  const setDetailQuery = (next: string) => {
    setDetailQueryState(next)
    updateQuery({ detail: next })
  }
  const setActiveTabKey = (key: string) => {
    setActiveTabKeyState(key)
    setDetailQueryState('')
    updateQuery({ tab: key, detail: '' })
  }
  const isCompactView = isCompactLayout || isTouchInteraction

  const activeTab = useMemo(() => tabs.find(tab => tab.key === activeTabKey), [tabs, activeTabKey])
  const compactTabOptions = useMemo(() => {
    const groups: Array<{ label: string; options: Array<{ label: string; value: string }> }> = []
    let currentGroup: { label: string; options: Array<{ label: string; value: string }> } | null = null

    tabs.forEach((tab) => {
      if (tab.type === 'group') {
        currentGroup = { label: String(tab.label), options: [] }
        groups.push(currentGroup)
        return
      }

      if (currentGroup == null) {
        currentGroup = { label: t('config.groups.config'), options: [] }
        groups.push(currentGroup)
      }

      currentGroup.options.push({
        value: tab.key,
        label: String(tab.label)
      })
    })

    return groups
  }, [tabs, t])
  const uiSections = schemaData?.workspace.uiSchema?.sections ?? {}

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
    setSourceKeyState(querySourceKey)
  }, [querySourceKey])

  useEffect(() => {
    setActiveTabKeyState(queryTabKey)
  }, [queryTabKey])

  useEffect(() => {
    setDetailQueryState(queryValues.detail)
  }, [queryValues.detail])

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
  const worktreeEnvironmentOptions = useMemo(() => (
    worktreeEnvironmentData?.environments.map(environment => ({
      value: toEnvironmentReference(environment),
      label: `${toDisplayEnvironmentName(environment.id)} (${
        environment.isLocal
          ? t('config.environments.sources.user')
          : t('config.environments.sources.project')
      })`
    })) ?? []
  ), [t, worktreeEnvironmentData?.environments])

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
      } catch (error) {
        void message.error(getApiErrorMessage(error, t('config.saveFailed')))
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

  const renderTabContent = (tab: typeof tabs[number]) => (
    <div key={`${sourceKey}:${tab.key}`} className='config-view__content'>
      {tab.key === 'about' && (
        <AboutSection value={tab.value as AboutInfo | undefined} />
      )}
      {tab.key === 'appearance' && (
        <AppSettingsPanel t={t} />
      )}
      {tab.key === 'worktreeEnvironments' && (
        <WorktreeEnvironmentPanel t={t} />
      )}
      {tab.key !== 'about' &&
        tab.key !== 'appearance' &&
        tab.key !== 'worktreeEnvironments' &&
        !configTabKeys.has(tab.key) && (
          <DisplayValue value={tab.value} sectionKey={tab.key} t={t} />
        )}
      {configTabKeys.has(tab.key) && (
        <ConfigSectionPanel
          sectionKey={tab.key}
          title={tab.label}
          icon={tab.icon}
          uiSection={uiSections[tab.key] as ConfigUiSection | undefined}
          value={drafts[getDraftKey(tab.key)] ?? cloneValue(tab.value ?? {}) ?? {}}
          onChange={(next) => handleDraftChange(tab.key, next)}
          mergedModelServices={mergedModelServices as Record<string, unknown>}
          mergedAdapters={mergedAdapters as Record<string, unknown>}
          selectedModelService={selectedModelService}
          worktreeEnvironmentOptions={worktreeEnvironmentOptions}
          detailQuery={activeTabKey === tab.key ? detailQuery : ''}
          onDetailQueryChange={activeTabKey === tab.key ? setDetailQuery : undefined}
          t={t}
          headerExtra={isCompactView
            ? undefined
            : (
              <Space size={12}>
                <ConfigSourceSwitch
                  value={sourceKey}
                  onChange={setSourceKey}
                  options={[
                    {
                      value: 'project',
                      icon: 'folder',
                      label: configPresent?.project === true
                        ? t('config.sources.project')
                        : t('config.sources.projectMissing')
                    },
                    {
                      value: 'user',
                      icon: 'person',
                      label: configPresent?.user === true
                        ? t('config.sources.user')
                        : t('config.sources.userMissing')
                    }
                  ]}
                />
              </Space>
            )}
        />
      )}
    </div>
  )

  return (
    <PageShell
      className={`config-view ${isCompactView ? 'config-view--compact' : ''}`}
      bodyClassName='config-view__body'
    >
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
        isCompactView
          ? (
            <div className='config-view__compact-shell'>
              <div className='config-view__compact-controls'>
                <Select
                  value={activeTabKey}
                  onChange={setActiveTabKey}
                  options={compactTabOptions}
                  className='config-view__compact-select'
                  popupMatchSelectWidth={false}
                />
                {activeTab != null && configTabKeys.has(activeTab.key) && (
                  <ConfigSourceSwitch
                    value={sourceKey}
                    onChange={setSourceKey}
                    options={[
                      {
                        value: 'project',
                        icon: 'folder',
                        label: configPresent?.project === true
                          ? t('config.sources.project')
                          : t('config.sources.projectMissing')
                      },
                      {
                        value: 'user',
                        icon: 'person',
                        label: configPresent?.user === true
                          ? t('config.sources.user')
                          : t('config.sources.userMissing')
                      }
                    ]}
                  />
                )}
              </div>
              <div className='config-view__compact-panel'>
                {activeTab != null ? renderTabContent(activeTab) : null}
              </div>
            </div>
          )
          : (
            <div className='config-view__tabs-wrap'>
              <Tabs
                destroyOnHidden
                tabPosition='left'
                tabBarGutter={4}
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
                    children: renderTabContent(tab)
                  }
                })}
              />
            </div>
          )
      )}
    </PageShell>
  )
}
