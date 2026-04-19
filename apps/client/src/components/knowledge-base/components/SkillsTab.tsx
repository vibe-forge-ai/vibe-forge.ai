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
  listSkills,
  searchSkillHub,
  updateConfig
} from '#~/api.js'
import { ProjectSkillsList } from './ProjectSkillsList'
import { SkillArchiveInput } from './SkillArchiveInput'
import { SkillMarketView } from './SkillMarketView'
import { SkillRegistryModal } from './SkillRegistryModal'
import { SkillsTabActions } from './SkillsTabActions'
import { TabContent } from './TabContent'
import { ALL_REGISTRIES, buildPluginsWithRegistry, buildRegistrySource, filterProjectSkills } from './skill-hub-utils'
import type { RegistryFormValues } from './skill-hub-utils'

interface SkillsTabProps {
  leading?: ReactNode
  projectQuery: string
  viewMode: 'project' | 'market'
  onRefresh: () => void | Promise<void>
  onCreate: () => void
  onViewModeChange: (value: 'project' | 'market') => void
}

export function SkillsTab({
  leading,
  projectQuery,
  viewMode,
  onCreate,
  onRefresh,
  onViewModeChange
}: SkillsTabProps) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const importInputRef = React.useRef<HTMLInputElement | null>(null)
  const [query, setQuery] = React.useState('')
  const [registry, setRegistry] = React.useState(ALL_REGISTRIES)
  const [addRegistryOpen, setAddRegistryOpen] = React.useState(false)
  const [savingRegistry, setSavingRegistry] = React.useState(false)
  const [installingId, setInstallingId] = React.useState<string | null>(null)
  const [importing, setImporting] = React.useState(false)
  const [form] = Form.useForm<RegistryFormValues>()
  const {
    data: skillsRes,
    isLoading: isSkillsLoading,
    mutate: mutateSkills
  } = useSWR<{ skills: SkillSummary[] }>('/api/ai/skills', listSkills)
  const { data: configRes, mutate: mutateConfig } = useSWR<ConfigResponse>('/api/config', getConfig)
  const {
    data: hubRes,
    isLoading: isHubLoading,
    mutate: mutateHub
  } = useSWR(
    viewMode === 'market' ? ['skill-hub-search', registry, query] : null,
    () => searchSkillHub({ registry, query })
  )

  const skills = skillsRes?.skills ?? []
  const registries = hubRes?.registries ?? []
  const hubItems = hubRes?.items ?? []
  const filteredSkills = React.useMemo(() => filterProjectSkills(skills, projectQuery), [projectQuery, skills])
  const registryOptions = React.useMemo(() => [
    { label: t('knowledge.skills.allRegistries'), value: ALL_REGISTRIES },
    ...registries.map(item => ({ label: item.id, value: item.id }))
  ], [registries, t])

  const handleRefresh = async () => {
    await Promise.all([mutateSkills(), mutateHub(), mutateConfig(), onRefresh()])
  }

  const handleInstall = async (item: SkillHubItem) => {
    setInstallingId(item.id)
    try {
      await installSkillHubItem({
        registry: item.registry,
        plugin: item.name,
        force: item.installed
      })
      await Promise.all([mutateHub(), mutateSkills()])
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

  const handleAddRegistry = async () => {
    const values = await form.validateFields()
    const id = values.id.trim()
    const source = buildRegistrySource(values)
    const projectPlugins = configRes?.sources?.project?.plugins ?? {}
    const existingMarketplaces = projectPlugins.marketplaces ?? {}
    if (Object.hasOwn(existingMarketplaces, id)) {
      void message.warning(t('knowledge.skills.registryExists'))
      return
    }

    setSavingRegistry(true)
    try {
      await updateConfig('project', 'plugins', buildPluginsWithRegistry(projectPlugins, id, source))
      setRegistry(id)
      setAddRegistryOpen(false)
      form.resetFields()
      await Promise.all([mutateConfig(), mutateHub()])
      void message.success(t('knowledge.skills.registrySaved'))
    } catch (error) {
      void message.error(getApiErrorMessage(error, t('config.saveFailed')))
    } finally {
      setSavingRegistry(false)
    }
  }

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
          hubItems={hubItems}
          installingId={installingId}
          isLoading={isHubLoading}
          query={query}
          registries={registries}
          registry={registry}
          registryOptions={registryOptions}
          skillCount={skills.length}
          onAddRegistry={() => setAddRegistryOpen(true)}
          onInstall={handleInstall}
          onQueryChange={setQuery}
          onRegistryChange={setRegistry}
        />
      )}
      <SkillRegistryModal
        open={addRegistryOpen}
        saving={savingRegistry}
        form={form}
        onSave={() => void handleAddRegistry()}
        onClose={() => setAddRegistryOpen(false)}
      />
    </TabContent>
  )
}
