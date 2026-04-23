import './SkillsTab.scss'

import { App } from 'antd'
import React from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import useSWR from 'swr'

import type { ConfigResponse } from '@vibe-forge/types'

import type { SkillSummary } from '#~/api.js'
import { getConfig, listSkills } from '#~/api.js'
import { useSkillsCliModalController } from './@hooks/use-skills-cli-modal-controller'
import { useSkillsTabActions } from './@hooks/use-skills-tab-actions'
import { ProjectSkillsList } from './ProjectSkillsList'
import { SkillArchiveInput } from './SkillArchiveInput'
import { SkillMarketView } from './SkillMarketView'
import { SkillRegistryModal } from './SkillRegistryModal'
import { SkillsCliModal } from './SkillsCliModal'
import { SkillsTabActions } from './SkillsTabActions'
import { TabContent } from './TabContent'
import { ALL_REGISTRIES, filterProjectSkills } from './skill-hub-utils'
import type { SkillHubInstallFilter, SkillHubSortKey } from './skill-hub-utils'
import { useSkillMarketFilters } from './use-skill-market-filters'
import { useSkillMarketSearch } from './use-skill-market-search'
import { useSkillRegistryModal } from './use-skill-registry-modal'

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
  const actions = useSkillsTabActions({
    marketMutate: marketSearch.mutate,
    message,
    mutateConfig,
    mutateSkills,
    onRefresh,
    t
  })
  const skillsCliModal = useSkillsCliModalController({
    message,
    mutateSkills,
    t
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

  return (
    <TabContent className='knowledge-base-view__skills-tab'>
      <SkillsTabActions
        importing={actions.importing}
        leading={leading}
        viewMode={viewMode}
        onRefresh={() => void actions.handleRefresh()}
        onImport={() => actions.importInputRef.current?.click()}
        onOpenConfig={() => navigate('/config?tab=plugins')}
        onViewModeChange={onViewModeChange}
      />
      <SkillArchiveInput
        inputRef={actions.importInputRef}
        onSelect={(file) => void actions.handleImportArchive(file)}
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
          installingId={actions.installingId}
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
          onOpenSkillsCli={() => skillsCliModal.setOpen(true)}
          onInstall={actions.handleInstall}
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
        canLoadMore={skillsCliModal.hasMore}
        form={skillsCliModal.form}
        hasSearched={skillsCliModal.hasSearched}
        installingId={skillsCliModal.installingId}
        items={skillsCliModal.items}
        loadingMore={skillsCliModal.loadingMore}
        open={skillsCliModal.open}
        resetKey={skillsCliModal.resetKey}
        searchError={skillsCliModal.searchError}
        searching={skillsCliModal.searching}
        onClose={skillsCliModal.handleClose}
        onInstall={skillsCliModal.handleInstall}
        onLoadMore={() => void skillsCliModal.handleLoadMore()}
        onSearch={() => void skillsCliModal.handleSearch()}
      />
    </TabContent>
  )
}
