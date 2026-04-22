import './SkillsTab.scss'

import { App, Form } from 'antd'
import React from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import useSWR from 'swr'

import type { ConfigResponse } from '@vibe-forge/types'

import type { SkillHubItem, SkillSummary } from '#~/api.js'
import {
  getApiErrorMessage,
  getConfig,
  importSkillArchive,
  installSkillHubItem,
  installSkillsCliItem,
  listSkills,
  searchSkillsCli
} from '#~/api.js'
import { ProjectSkillsList } from './ProjectSkillsList'
import { SkillArchiveInput } from './SkillArchiveInput'
import { SkillMarketView } from './SkillMarketView'
import { SkillRegistryModal } from './SkillRegistryModal'
import { SkillsCliModal } from './SkillsCliModal'
import type { SkillsCliFormValues } from './SkillsCliModal'
import { SkillsTabActions } from './SkillsTabActions'
import { TabContent } from './TabContent'
import { ALL_REGISTRIES, filterProjectSkills } from './skill-hub-utils'
import type { SkillHubInstallFilter, SkillHubSortKey } from './skill-hub-utils'
import { useSkillMarketFilters } from './use-skill-market-filters'
import { useSkillMarketSearch } from './use-skill-market-search'
import { useSkillRegistryModal } from './use-skill-registry-modal'

const SKILLS_CLI_INITIAL_LIMIT = 100
const SKILLS_CLI_LIMIT_STEP = 100
const SKILLS_CLI_MAX_LIMIT = 500

const trimOptionalString = (value: string | undefined) => {
  const normalizedValue = value?.trim()
  return normalizedValue == null || normalizedValue === '' ? undefined : normalizedValue
}

interface SkillsTabProps {
  leading?: ReactNode
  installFilter: SkillHubInstallFilter
  marketQuery: string
  projectQuery: string
  registry: string
  sortKey: SkillHubSortKey
  sourceFilter: string
  viewMode: 'project' | 'market'
  onRefresh: () => void | Promise<void>
  onCreate: () => void
  onInstallFilterChange: (value: SkillHubInstallFilter) => void
  onMarketQueryChange: (value: string) => void
  onRegistryChange: (value: string) => void
  onSortChange: (value: SkillHubSortKey) => void
  onSourceFilterChange: (value: string) => void
  onViewModeChange: (value: 'project' | 'market') => void
}

export function SkillsTab({
  leading,
  installFilter,
  marketQuery,
  projectQuery,
  registry,
  sortKey,
  sourceFilter,
  viewMode,
  onCreate,
  onInstallFilterChange,
  onMarketQueryChange,
  onRegistryChange,
  onRefresh,
  onSortChange,
  onSourceFilterChange,
  onViewModeChange
}: SkillsTabProps) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const importInputRef = React.useRef<HTMLInputElement | null>(null)
  const [installingId, setInstallingId] = React.useState<string | null>(null)
  const [importing, setImporting] = React.useState(false)
  const [skillsCliOpen, setSkillsCliOpen] = React.useState(false)
  const [skillsCliSearching, setSkillsCliSearching] = React.useState(false)
  const [skillsCliLoadingMore, setSkillsCliLoadingMore] = React.useState(false)
  const [skillsCliInstallingId, setSkillsCliInstallingId] = React.useState<string | null>(null)
  const [skillsCliItems, setSkillsCliItems] = React.useState<SkillHubItem[]>([])
  const [skillsCliError, setSkillsCliError] = React.useState<string | null>(null)
  const [skillsCliHasMore, setSkillsCliHasMore] = React.useState(false)
  const [skillsCliHasSearched, setSkillsCliHasSearched] = React.useState(false)
  const [skillsCliLimit, setSkillsCliLimit] = React.useState(SKILLS_CLI_INITIAL_LIMIT)
  const [skillsCliResetKey, setSkillsCliResetKey] = React.useState('')
  const [skillsCliForm] = Form.useForm<SkillsCliFormValues>()
  const {
    data: skillsRes,
    isLoading: isSkillsLoading,
    mutate: mutateSkills
  } = useSWR<{ skills: SkillSummary[] }>('/api/ai/skills', listSkills)
  const { data: configRes, mutate: mutateConfig } = useSWR<ConfigResponse>('/api/config', getConfig)
  const marketSearch = useSkillMarketSearch({ installFilter, marketQuery, registry, sortKey, sourceFilter, viewMode })
  const registryModal = useSkillRegistryModal({
    configRes,
    mutateConfig,
    mutateHub: marketSearch.mutate,
    setRegistry: onRegistryChange
  })

  const skills = skillsRes?.skills ?? []
  const registries = marketSearch.data?.registries ?? []
  const hubItems = marketSearch.data?.items ?? []
  const filteredSkills = React.useMemo(() => filterProjectSkills(skills, projectQuery), [projectQuery, skills])
  const marketFilters = useSkillMarketFilters(hubItems, {
    sourceFilter,
    installFilter,
    sortKey
  })
  const registryOptions = React.useMemo(() => [
    { label: t('knowledge.skills.allRegistries'), value: ALL_REGISTRIES },
    ...registries.map(item => ({ label: item.id, value: item.id }))
  ], [registries, t])

  const handleRefresh = async () => {
    await Promise.all([mutateSkills(), marketSearch.mutate(), mutateConfig(), onRefresh()])
  }

  const handleInstall = async (item: SkillHubItem) => {
    setInstallingId(item.id)
    try {
      await installSkillHubItem({
        registry: item.registry,
        plugin: item.installRef ?? item.name,
        force: item.installed
      })
      await Promise.all([marketSearch.mutate(), mutateSkills()])
      void message.success(t('knowledge.skills.installSuccess'))
    } catch (error) {
      void message.error(getApiErrorMessage(error, t('knowledge.skills.installFailed')))
    } finally {
      setInstallingId(null)
    }
  }

  const handleImportArchive = async (file: File) => {
    setImporting(true)
    try {
      const result = await importSkillArchive(file)
      await Promise.all([mutateSkills(), onRefresh()])
      void message.success(t('knowledge.skills.importSuccess', { count: result.fileCount }))
    } catch (error) {
      void message.error(getApiErrorMessage(error, t('knowledge.skills.importFailed')))
    } finally {
      setImporting(false)
    }
  }

  const resolveSkillsCliRequest = React.useCallback(async () => {
    try {
      await skillsCliForm.validateFields(['source'])
    } catch {
      return undefined
    }

    const values = skillsCliForm.getFieldsValue()
    const source = values.source.trim()
    return {
      source,
      query: trimOptionalString(values.query),
      registry: trimOptionalString(values.registry)
    }
  }, [skillsCliForm])

  const runSkillsCliSearch = React.useCallback(async (nextLimit: number) => {
    const request = await resolveSkillsCliRequest()
    if (request == null) return false

    const result = await searchSkillsCli({
      limit: nextLimit,
      source: request.source,
      ...(request.query != null ? { query: request.query } : {}),
      ...(request.registry != null ? { registry: request.registry } : {})
    })

    setSkillsCliHasSearched(true)
    setSkillsCliLimit(nextLimit)
    setSkillsCliItems(result.items)
    setSkillsCliError(result.error ?? null)
    setSkillsCliHasMore(result.hasMore === true && nextLimit < SKILLS_CLI_MAX_LIMIT)
    setSkillsCliResetKey([request.source, request.query ?? '', request.registry ?? '', String(nextLimit)].join('\0'))
    return true
  }, [resolveSkillsCliRequest])

  const handleSearchSkillsCli = async () => {
    setSkillsCliSearching(true)
    setSkillsCliLoadingMore(false)
    try {
      await runSkillsCliSearch(SKILLS_CLI_INITIAL_LIMIT)
    } catch (error) {
      void message.error(getApiErrorMessage(error, t('knowledge.skills.skillsCliSearchFailed')))
    } finally {
      setSkillsCliSearching(false)
    }
  }

  const handleLoadMoreSkillsCli = async () => {
    const nextLimit = Math.min(skillsCliLimit + SKILLS_CLI_LIMIT_STEP, SKILLS_CLI_MAX_LIMIT)
    if (nextLimit === skillsCliLimit) return

    setSkillsCliLoadingMore(true)
    try {
      await runSkillsCliSearch(nextLimit)
    } catch (error) {
      void message.error(getApiErrorMessage(error, t('knowledge.skills.skillsCliSearchFailed')))
    } finally {
      setSkillsCliLoadingMore(false)
    }
  }

  const handleInstallSkillsCli = async (item: SkillHubItem) => {
    const request = await resolveSkillsCliRequest()
    if (request == null) return

    setSkillsCliInstallingId(item.id)
    try {
      await installSkillsCliItem({
        source: request.source,
        skill: item.installRef ?? item.name,
        force: item.installed,
        ...(request.registry != null ? { registry: request.registry } : {})
      })
      await mutateSkills()
      try {
        await runSkillsCliSearch(skillsCliLimit)
      } catch {
        // Keep the install success state even if refreshing the source list fails afterwards.
      }
      void message.success(t('knowledge.skills.installSuccess'))
    } catch (error) {
      void message.error(getApiErrorMessage(error, t('knowledge.skills.installFailed')))
    } finally {
      setSkillsCliInstallingId(null)
    }
  }

  const handleCloseSkillsCli = React.useCallback(() => {
    setSkillsCliOpen(false)
    setSkillsCliSearching(false)
    setSkillsCliLoadingMore(false)
    setSkillsCliInstallingId(null)
    setSkillsCliItems([])
    setSkillsCliError(null)
    setSkillsCliHasMore(false)
    setSkillsCliHasSearched(false)
    setSkillsCliLimit(SKILLS_CLI_INITIAL_LIMIT)
    setSkillsCliResetKey('')
    skillsCliForm.resetFields()
  }, [skillsCliForm])

  return (
    <TabContent className='knowledge-base-view__skills-tab'>
      <SkillsTabActions
        importing={importing}
        leading={leading}
        viewMode={viewMode}
        onRefresh={() => void handleRefresh()}
        onImport={() => importInputRef.current?.click()}
        onOpenConfig={() => navigate('/config?tab=plugins')}
        onViewModeChange={onViewModeChange}
      />
      <SkillArchiveInput
        inputRef={importInputRef}
        onSelect={(file) => void handleImportArchive(file)}
      />
      {viewMode === 'project' && (
        <ProjectSkillsList
          allCount={skills.length}
          isLoading={isSkillsLoading}
          skills={filteredSkills}
          onCreate={onCreate}
        />
      )}
      {viewMode === 'market' && (
        <SkillMarketView
          hubItems={marketFilters.filteredHubItems}
          installingId={installingId}
          installFilter={installFilter}
          isLoading={marketSearch.isLoading && hubItems.length === 0}
          query={marketQuery}
          registries={registries}
          registry={registry}
          registryOptions={registryOptions}
          sortKey={sortKey}
          sourceFilter={sourceFilter}
          sourceOptions={marketFilters.sourceOptions}
          canLoadMore={marketSearch.canLoadMore}
          loadingMore={marketSearch.isValidating && hubItems.length > 0}
          onAddRegistry={() => registryModal.setOpen(true)}
          onOpenSkillsCli={() => setSkillsCliOpen(true)}
          onInstall={handleInstall}
          onInstallFilterChange={onInstallFilterChange}
          onLoadMore={marketSearch.loadMore}
          onQueryChange={onMarketQueryChange}
          onRegistryChange={onRegistryChange}
          resetKey={marketSearch.resetKey}
          onSortChange={onSortChange}
          onSourceFilterChange={onSourceFilterChange}
        />
      )}
      <SkillRegistryModal
        open={registryModal.open}
        saving={registryModal.saving}
        form={registryModal.form}
        onSave={() => void registryModal.save()}
        onClose={() => registryModal.setOpen(false)}
      />
      <SkillsCliModal
        canLoadMore={skillsCliHasMore}
        form={skillsCliForm}
        hasSearched={skillsCliHasSearched}
        installingId={skillsCliInstallingId}
        items={skillsCliItems}
        loadingMore={skillsCliLoadingMore}
        open={skillsCliOpen}
        resetKey={skillsCliResetKey}
        searchError={skillsCliError}
        searching={skillsCliSearching}
        onClose={handleCloseSkillsCli}
        onInstall={handleInstallSkillsCli}
        onLoadMore={() => void handleLoadMoreSkillsCli()}
        onSearch={() => void handleSearchSkillsCli()}
      />
    </TabContent>
  )
}
