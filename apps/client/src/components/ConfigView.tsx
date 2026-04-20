import './ConfigView.scss'

import { App, Button, Empty, Input, Space, Spin, Tooltip } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import type { ConfigSource } from '@vibe-forge/core'
import type { AboutInfo, ConfigResponse, ConfigUiSection } from '@vibe-forge/types'

import { useMobileSidebarModal } from '#~/components/layout/@hooks/use-mobile-sidebar-modal'
import { PageShell } from '#~/components/layout/PageShell'
import { useResponsiveLayout } from '#~/hooks/use-responsive-layout'

import { getApiErrorMessage, getConfig, getConfigSchema, listWorktreeEnvironments, updateConfig } from '../api'
import { useQueryParams } from '../hooks/useQueryParams'
import { AboutSection, ConfigSectionPanel, ConfigSourceSwitch, DisplayValue } from './config'
import { AppSettingsPanel } from './config/AppSettingsPanel'
import {
  getConfigDraftKey,
  resolveRemoteConfigChangeAction,
  serializeComparableConfigValue
} from './config/configConflict'
import { MdpTopologyPanel } from './config/MdpTopologyPanel'
import { WorktreeEnvironmentPanel } from './config/WorktreeEnvironmentPanel'
import { cloneValue, getValueByPath, isEmptyValue } from './config/configUtils'
import { toDisplayEnvironmentName, toEnvironmentReference } from './config/worktree-environment-panel-model'

interface ConfigDraftConflict {
  draftKey: string
  sectionKey: string
  source: ConfigSource
  remoteValue: unknown
}

export function ConfigView() {
  const { t } = useTranslation()
  const { message, modal } = App.useApp()
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
  const [navSearchQuery, setNavSearchQuery] = useState('')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, unknown>>({})
  const configPresent = data?.meta?.configPresent
  const currentSource = data?.sources?.[sourceKey]
  const currentResolvedSource = data?.resolvedSources?.[sourceKey]
  const draftsRef = useRef<Record<string, unknown>>(drafts)
  const compactContentRegionRef = useRef<HTMLDivElement | null>(null)
  const compactSidebarSheetRef = useRef<HTMLDivElement | null>(null)
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const savingRef = useRef<Record<string, boolean>>({})
  const lastSavedRef = useRef<Record<string, string>>({})
  const baseSnapshotsRef = useRef<Record<string, string>>({})
  const blockedDraftKeysRef = useRef<Record<string, boolean>>({})
  const pendingConflictsRef = useRef<Record<string, ConfigDraftConflict>>({})
  const compactSidebarBackgroundRefs = useMemo(() => [compactContentRegionRef], [])
  const [pendingConflicts, setPendingConflicts] = useState<Record<string, ConfigDraftConflict>>({})
  const [activeConflictKey, setActiveConflictKey] = useState<string | null>(null)
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
      'mdp',
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
    { key: 'mdp', icon: 'hub', label: t('config.sections.mdp'), value: currentSource?.mdp },
    { key: 'mdpTopology', icon: 'lan', label: t('config.sections.mdpTopology') },
    { key: 'shortcuts', icon: 'keyboard', label: t('config.sections.shortcuts'), value: currentSource?.shortcuts },
    { key: 'group-app', type: 'group', label: t('config.groups.app') },
    { key: 'appearance', icon: 'tune', label: t('config.sections.appearance') },
    { key: 'experiments', icon: 'science', label: t('config.sections.experiments'), value: data?.meta?.experiments },
    { key: 'about', icon: 'info', label: t('config.sections.about'), value: data?.meta?.about }
  ], [currentSource, data?.meta?.about, data?.meta?.experiments, t])
  const tabKeys = useMemo(() => new Set(tabs.filter(tab => tab.type !== 'group').map(tab => tab.key)), [tabs])
  const desktopNavGroups = useMemo(() => {
    type NavTab = Exclude<(typeof tabs)[number], { type: 'group' }>
    interface NavGroup {
      key: string
      label: string
      tabs: NavTab[]
    }

    const query = navSearchQuery.trim().toLowerCase()
    const groups: NavGroup[] = []
    let currentGroup: NavGroup | null = null

    tabs.forEach((tab) => {
      if (tab.type === 'group') {
        if (currentGroup != null && currentGroup.tabs.length > 0) {
          groups.push(currentGroup)
        }
        currentGroup = { key: tab.key, label: String(tab.label), tabs: [] }
        return
      }

      if (currentGroup == null) {
        currentGroup = { key: 'group-config', label: t('config.groups.config'), tabs: [] }
      }
      const targetGroup = currentGroup
      const navTab = tab as NavTab

      const label = String(tab.label)
      const matches = query === '' ||
        label.toLowerCase().includes(query) ||
        tab.key.toLowerCase().includes(query)

      if (matches) {
        targetGroup.tabs.push(navTab)
      }
    })

    if (currentGroup != null) {
      groups.push(currentGroup)
    }

    return groups.filter(group => group.tabs.length > 0)
  }, [navSearchQuery, t, tabs])

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
  const resolveTooltipTitle = (title: string) => isTouchInteraction ? undefined : title

  const activeTab = useMemo(() => tabs.find(tab => tab.key === activeTabKey), [tabs, activeTabKey])
  const uiSections = schemaData?.workspace.uiSchema?.sections ?? {}
  const sourceOptions = useMemo(() => [
    {
      value: 'project' as const,
      icon: 'folder',
      label: configPresent?.project === true
        ? t('config.sources.project')
        : t('config.sources.projectMissing')
    },
    {
      value: 'user' as const,
      icon: 'person',
      label: configPresent?.user === true
        ? t('config.sources.user')
        : t('config.sources.userMissing')
    }
  ], [configPresent?.project, configPresent?.user, t])

  useMobileSidebarModal({
    backgroundRefs: compactSidebarBackgroundRefs,
    isCompactLayout: isCompactView,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
    sheetRef: compactSidebarSheetRef
  })

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
    if (!isCompactView) return
    setIsSidebarCollapsed(false)
  }, [isCompactView])

  useEffect(() => {
    if (isCompactView) return
    setIsMobileSidebarOpen(false)
  }, [isCompactView])

  useEffect(() => {
    draftsRef.current = drafts
  }, [drafts])

  useEffect(() => {
    pendingConflictsRef.current = pendingConflicts
  }, [pendingConflicts])

  useEffect(() => {
    return () => {
      Object.values(saveTimersRef.current).forEach((timer) => {
        clearTimeout(timer)
      })
    }
  }, [])

  const clearSaveTimer = (draftKey: string) => {
    const timer = saveTimersRef.current[draftKey]
    if (timer == null) return
    clearTimeout(timer)
    delete saveTimersRef.current[draftKey]
  }

  const clearDraftConflict = (draftKey: string) => {
    delete blockedDraftKeysRef.current[draftKey]
    setPendingConflicts((prev) => {
      if (prev[draftKey] == null) return prev
      const next = { ...prev }
      delete next[draftKey]
      return next
    })
    setActiveConflictKey(prev => prev === draftKey ? null : prev)
  }

  const getDraftKey = (sectionKey: string, source = sourceKey) => getConfigDraftKey(sectionKey, source)
  const generalDraftValue = useMemo(() => {
    const draftKey = getDraftKey('general')
    return (drafts[draftKey] ?? cloneValue(currentSource?.general ?? {}) ?? {}) as Record<string, unknown>
  }, [drafts, currentSource?.general, sourceKey])
  const selectedModelService = (() => {
    const value = getValueByPath(generalDraftValue, ['defaultModelService'])
    if (typeof value === 'string' && value !== '') return value
    const fallbackValue = getValueByPath(currentResolvedSource?.general, ['defaultModelService'])
    return typeof fallbackValue === 'string' && fallbackValue !== '' ? fallbackValue : undefined
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

  const persistDraftValue = async ({
    draftKey,
    sectionKey,
    source,
    value
  }: {
    draftKey: string
    sectionKey: string
    source: ConfigSource
    value: unknown
  }) => {
    const serialized = serializeComparableConfigValue(value)

    if (savingRef.current[draftKey]) {
      throw new Error(`config draft ${draftKey} is already saving`)
    }

    savingRef.current[draftKey] = true
    try {
      await updateConfig(source, sectionKey, value)
      lastSavedRef.current[draftKey] = serialized
      baseSnapshotsRef.current[draftKey] = serialized
      await mutate()
    } catch (error) {
      void message.error(getApiErrorMessage(error, t('config.saveFailed')))
      throw error
    } finally {
      savingRef.current[draftKey] = false
    }
  }

  const scheduleSave = (sectionKey: string, source: ConfigSource, nextValue: unknown) => {
    const draftKey = getDraftKey(sectionKey, source)
    if (blockedDraftKeysRef.current[draftKey]) {
      clearSaveTimer(draftKey)
      return
    }

    const serialized = serializeComparableConfigValue(nextValue)
    if (lastSavedRef.current[draftKey] === serialized) {
      return
    }
    clearSaveTimer(draftKey)
    saveTimersRef.current[draftKey] = setTimeout(async () => {
      if (blockedDraftKeysRef.current[draftKey]) return
      if (savingRef.current[draftKey]) return
      const currentValue = draftsRef.current[draftKey] ?? nextValue
      const currentSerialized = serializeComparableConfigValue(currentValue)
      if (lastSavedRef.current[draftKey] === currentSerialized) return
      try {
        await persistDraftValue({
          draftKey,
          sectionKey,
          source,
          value: currentValue
        })
      } catch {}
    }, 800)
  }

  const handleDraftChange = (sectionKey: string, nextValue: unknown) => {
    const draftKey = getDraftKey(sectionKey)
    setDrafts(prev => ({ ...prev, [draftKey]: nextValue }))
    scheduleSave(sectionKey, sourceKey, nextValue)
  }

  useEffect(() => {
    const nextDrafts: Record<string, unknown> = {}
    let hasDraftUpdates = false
    const previousConflicts = pendingConflictsRef.current
    let nextConflicts = previousConflicts
    let conflictsChanged = false
    const ensureMutableConflicts = () => {
      if (!conflictsChanged) {
        nextConflicts = { ...previousConflicts }
        conflictsChanged = true
      }
      return nextConflicts
    }

    ;(['project', 'user'] as const).forEach((source) => {
      const sourceData = data?.sources?.[source]
      if (sourceData == null) return

      configTabKeys.forEach((sectionKey) => {
        const draftKey = getConfigDraftKey(sectionKey, source)
        const serverValue = cloneValue((sourceData as Record<string, unknown>)[sectionKey] ?? {}) ?? {}
        const serverSerialized = serializeComparableConfigValue(serverValue)
        const baseSerialized = baseSnapshotsRef.current[draftKey]

        if (baseSerialized == null) {
          baseSnapshotsRef.current[draftKey] = serverSerialized
          lastSavedRef.current[draftKey] ??= serverSerialized
          return
        }

        const currentDraft = draftsRef.current[draftKey]
        if (currentDraft === undefined) {
          baseSnapshotsRef.current[draftKey] = serverSerialized
          lastSavedRef.current[draftKey] = serverSerialized
          delete blockedDraftKeysRef.current[draftKey]
          if (nextConflicts[draftKey] != null) {
            delete ensureMutableConflicts()[draftKey]
          }
          return
        }

        const draftSerialized = serializeComparableConfigValue(currentDraft)
        const action = resolveRemoteConfigChangeAction({
          baseSerialized,
          draftSerialized,
          serverSerialized
        })

        if (action === 'sync-remote') {
          clearSaveTimer(draftKey)
          delete blockedDraftKeysRef.current[draftKey]
          baseSnapshotsRef.current[draftKey] = serverSerialized
          lastSavedRef.current[draftKey] = serverSerialized
          nextDrafts[draftKey] = serverValue
          hasDraftUpdates = true
          if (nextConflicts[draftKey] != null) {
            delete ensureMutableConflicts()[draftKey]
          }
          return
        }

        if (action === 'conflict') {
          clearSaveTimer(draftKey)
          blockedDraftKeysRef.current[draftKey] = true
          const existingConflict = nextConflicts[draftKey]
          const existingRemoteSerialized = existingConflict == null
            ? undefined
            : serializeComparableConfigValue(existingConflict.remoteValue)
          if (
            existingConflict?.sectionKey !== sectionKey ||
            existingConflict?.source !== source ||
            existingRemoteSerialized !== serverSerialized
          ) {
            ensureMutableConflicts()[draftKey] = {
              draftKey,
              sectionKey,
              source,
              remoteValue: serverValue
            }
          }
          return
        }

        if (draftSerialized === serverSerialized) {
          baseSnapshotsRef.current[draftKey] = serverSerialized
          lastSavedRef.current[draftKey] = serverSerialized
        }

        delete blockedDraftKeysRef.current[draftKey]
        if (nextConflicts[draftKey] != null) {
          delete ensureMutableConflicts()[draftKey]
        }
      })
    })

    if (conflictsChanged) {
      setPendingConflicts(nextConflicts)
    }

    if (!hasDraftUpdates) return

    setDrafts((prev) => {
      let changed = false
      const next = { ...prev }
      Object.entries(nextDrafts).forEach(([draftKey, value]) => {
        const currentSerialized = serializeComparableConfigValue(prev[draftKey])
        const nextSerialized = serializeComparableConfigValue(value)
        if (currentSerialized === nextSerialized) return
        next[draftKey] = value
        changed = true
      })
      return changed ? next : prev
    })
  }, [configTabKeys, data?.sources?.project, data?.sources?.user])

  useEffect(() => {
    if (activeConflictKey != null) return

    const nextConflict = Object.values(pendingConflicts)[0]
    if (nextConflict == null) return

    const draftKey = nextConflict.draftKey
    setActiveConflictKey(draftKey)

    const sourceLabel = t(`config.sources.${nextConflict.source}`)
    const sectionLabel = t(`config.sections.${nextConflict.sectionKey}`, { defaultValue: nextConflict.sectionKey })

    modal.confirm({
      title: t('config.conflict.title'),
      content: (
        <div>
          <div>
            {t('config.conflict.description', {
              source: sourceLabel,
              target: sectionLabel
            })}
          </div>
          <div>{t('config.conflict.instructions')}</div>
        </div>
      ),
      okText: t('config.conflict.keepLocal'),
      cancelText: t('config.conflict.useRemote'),
      cancelButtonProps: { danger: true },
      closable: false,
      keyboard: false,
      maskClosable: false,
      onOk: async () => {
        const currentConflict = pendingConflictsRef.current[draftKey]
        const sectionKey = currentConflict?.sectionKey ?? nextConflict.sectionKey
        const source = currentConflict?.source ?? nextConflict.source
        const currentDraft = cloneValue(
          draftsRef.current[draftKey] ?? currentConflict?.remoteValue ?? nextConflict.remoteValue ?? {}
        ) ?? {}

        await persistDraftValue({
          draftKey,
          sectionKey,
          source,
          value: currentDraft
        })

        clearDraftConflict(draftKey)
      },
      onCancel: () => {
        const currentConflict = pendingConflictsRef.current[draftKey] ?? nextConflict
        const remoteValue = cloneValue(currentConflict.remoteValue ?? {}) ?? {}
        const remoteSerialized = serializeComparableConfigValue(remoteValue)

        clearSaveTimer(draftKey)
        baseSnapshotsRef.current[draftKey] = remoteSerialized
        lastSavedRef.current[draftKey] = remoteSerialized
        setDrafts(prev => ({ ...prev, [draftKey]: remoteValue }))
        clearDraftConflict(draftKey)
      }
    })
  }, [activeConflictKey, modal, pendingConflicts, t])

  const renderSidebarExpandButton = () => (
    <Tooltip title={resolveTooltipTitle(t('common.expand'))} placement='bottom'>
      <Button
        size='small'
        type='text'
        className='config-view__section-toggle'
        aria-label={t('common.expand')}
        icon={<span className='material-symbols-rounded'>left_panel_open</span>}
        onClick={() => {
          if (isCompactView) {
            setIsMobileSidebarOpen(true)
            return
          }
          setIsSidebarCollapsed(false)
        }}
      />
    </Tooltip>
  )

  const renderStandaloneHeader = (showSidebarToggle: boolean) => {
    if (!showSidebarToggle) return null
    return (
      <div className='config-view__standalone-header'>
        {renderSidebarExpandButton()}
      </div>
    )
  }

  const renderSidebar = ({ compact = false }: { compact?: boolean } = {}) => (
    <div className={`config-view__sidebar ${compact ? 'config-view__sidebar--compact' : ''}`}>
      <div className='config-view__sidebar-header'>
        <div className='config-view__sidebar-search-row'>
          <Input
            allowClear
            value={navSearchQuery}
            onChange={(event) => setNavSearchQuery(event.target.value)}
            prefix={<span className='material-symbols-rounded config-view__sidebar-search-icon'>search</span>}
            placeholder={t('config.navigation.search')}
            className='config-view__sidebar-search-input'
          />
          <Tooltip
            title={resolveTooltipTitle(compact ? t('common.close') : t('common.collapse'))}
            placement='bottom'
          >
            <Button
              type='text'
              className='config-view__sidebar-toggle'
              aria-label={compact ? t('common.close') : t('common.collapse')}
              onClick={() => {
                if (compact) {
                  setIsMobileSidebarOpen(false)
                  return
                }
                setIsSidebarCollapsed(true)
              }}
              icon={<span className='material-symbols-rounded'>{compact ? 'close' : 'left_panel_close'}</span>}
            />
          </Tooltip>
        </div>
      </div>
      <div className='config-view__sidebar-body'>
        {desktopNavGroups.length === 0
          ? (
            <div className='config-view__sidebar-empty'>{t('config.navigation.noResults')}</div>
          )
          : desktopNavGroups.map(group => (
            <div key={group.key} className='config-view__nav-group'>
              <div className='config-view__nav-group-label'>{group.label}</div>
              <div className='config-view__nav-list'>
                {group.tabs.map(tab => (
                  <button
                    key={tab.key}
                    type='button'
                    className={`config-view__nav-item ${activeTabKey === tab.key ? 'is-active' : ''}`}
                    onClick={() => {
                      setActiveTabKey(tab.key)
                      if (compact) {
                        setIsMobileSidebarOpen(false)
                      }
                    }}
                  >
                    <span className='config-view__tab-label'>
                      <span className='material-symbols-rounded config-view__tab-icon'>{tab.icon}</span>
                      <span className='config-view__tab-text'>{tab.label}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  )

  const renderTabContent = (
    tab: typeof tabs[number],
    { showSidebarToggle = false }: { showSidebarToggle?: boolean } = {}
  ) => (
    <div key={`${sourceKey}:${tab.key}`} className='config-view__content'>
      {renderStandaloneHeader(showSidebarToggle && !configTabKeys.has(tab.key))}
      {tab.key === 'about' && (
        <AboutSection value={tab.value as AboutInfo | undefined} />
      )}
      {tab.key === 'appearance' && (
        <AppSettingsPanel t={t} />
      )}
      {tab.key === 'worktreeEnvironments' && (
        <WorktreeEnvironmentPanel t={t} />
      )}
      {tab.key === 'mdpTopology' && (
        <MdpTopologyPanel t={t} />
      )}
      {tab.key !== 'about' &&
        tab.key !== 'appearance' &&
        tab.key !== 'mdpTopology' &&
        tab.key !== 'worktreeEnvironments' &&
        !configTabKeys.has(tab.key) && (
          <DisplayValue value={tab.value} sectionKey={tab.key} t={t} />
        )}
      {configTabKeys.has(tab.key) && (
        <>
          <ConfigSectionPanel
            sectionKey={tab.key}
            title={tab.label}
            icon={tab.icon}
            uiSection={uiSections[tab.key] as ConfigUiSection | undefined}
            value={drafts[getDraftKey(tab.key)] ?? cloneValue(tab.value ?? {}) ?? {}}
            resolvedValue={cloneValue(
              currentResolvedSource != null
                ? (currentResolvedSource as Record<string, unknown>)[tab.key]
                : undefined
            ) ?? {}}
            onChange={(next) => handleDraftChange(tab.key, next)}
            mergedModelServices={mergedModelServices as Record<string, unknown>}
            mergedAdapters={mergedAdapters as Record<string, unknown>}
            selectedModelService={selectedModelService}
            worktreeEnvironmentOptions={worktreeEnvironmentOptions}
            detailQuery={activeTabKey === tab.key ? detailQuery : ''}
            onDetailQueryChange={activeTabKey === tab.key ? setDetailQuery : undefined}
            t={t}
            headerLeading={showSidebarToggle ? renderSidebarExpandButton() : undefined}
            headerExtra={isCompactView
              ? undefined
              : (
                <Space size={12}>
                  <ConfigSourceSwitch
                    value={sourceKey}
                    onChange={setSourceKey}
                    options={sourceOptions}
                  />
                </Space>
              )}
          />
        </>
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
              <div
                ref={compactContentRegionRef}
                className='config-view__compact-region'
                aria-hidden={isMobileSidebarOpen ? true : undefined}
              >
                <div className='config-view__compact-panel'>
                  {activeTab != null ? renderTabContent(activeTab, { showSidebarToggle: true }) : null}
                </div>
              </div>
              <button
                type='button'
                className={`config-view__compact-backdrop ${isMobileSidebarOpen ? 'is-open' : ''}`}
                aria-label={t('common.close')}
                aria-hidden={!isMobileSidebarOpen}
                tabIndex={-1}
                onClick={() => setIsMobileSidebarOpen(false)}
              />
              <div
                ref={compactSidebarSheetRef}
                className={`config-view__compact-sidebar-sheet ${isMobileSidebarOpen ? 'is-open' : ''}`}
                role='dialog'
                aria-modal={isMobileSidebarOpen ? 'true' : undefined}
                aria-label={t('common.settings')}
                aria-hidden={!isMobileSidebarOpen}
                tabIndex={-1}
              >
                {renderSidebar({ compact: true })}
              </div>
            </div>
          )
          : (
            <div className={`config-view__desktop-shell ${isSidebarCollapsed ? 'is-sidebar-collapsed' : ''}`}>
              {renderSidebar()}
              <div className='config-view__desktop-content'>
                {activeTab != null ? renderTabContent(activeTab, { showSidebarToggle: isSidebarCollapsed }) : null}
              </div>
            </div>
          )
      )}
    </PageShell>
  )
}
