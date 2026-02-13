import './KnowledgeBaseView.scss'

import { App, Tabs } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import type { EntitySummary, SpecSummary } from '#~/api.js'
import { EntitiesTab } from './components/EntitiesTab.js'
import { FlowsTab } from './components/FlowsTab.js'
import { KnowledgeBaseHeader } from './components/KnowledgeBaseHeader.js'
import { RulesTab } from './components/RulesTab.js'
import { SkillsTab } from './components/SkillsTab.js'
import { TabLabel } from './components/TabLabel.js'

export function KnowledgeBaseView() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const {
    data: specsRes,
    isLoading: isSpecsLoading,
    mutate: mutateSpecs
  } = useSWR<{ specs: SpecSummary[] }>('/api/ai/specs')
  const {
    data: entitiesRes,
    isLoading: isEntitiesLoading,
    mutate: mutateEntities
  } = useSWR<{ entities: EntitySummary[] }>('/api/ai/entities')

  const specs = specsRes?.specs ?? []
  const entities = entitiesRes?.entities ?? []

  const [specQuery, setSpecQuery] = React.useState('')
  const [specTagFilter, setSpecTagFilter] = React.useState<string[]>([])
  const [entityQuery, setEntityQuery] = React.useState('')
  const [entityTagFilter, setEntityTagFilter] = React.useState<string[]>([])

  const specTagOptions = React.useMemo(() => {
    const tags = new Set<string>()
    specs.forEach(spec => {
      spec.tags?.forEach(tag => tags.add(tag))
    })
    return Array.from(tags).sort().map(tag => ({ label: tag, value: tag }))
  }, [specs])

  const entityTagOptions = React.useMemo(() => {
    const tags = new Set<string>()
    entities.forEach(entity => {
      entity.tags?.forEach(tag => tags.add(tag))
    })
    return Array.from(tags).sort().map(tag => ({ label: tag, value: tag }))
  }, [entities])

  const filteredSpecs = React.useMemo(() => {
    const query = specQuery.trim().toLowerCase()
    return specs.filter(spec => {
      const tags = spec.tags ?? []
      if (specTagFilter.length > 0 && !specTagFilter.every(tag => tags.includes(tag))) return false
      if (query === '') return true
      const paramsText = spec.params.map(param => `${param.name} ${param.description ?? ''}`).join(' ')
      const tagsText = tags.join(' ')
      const skillsText = (spec.skills ?? []).join(' ')
      const rulesText = (spec.rules ?? []).join(' ')
      const haystack = `${spec.name} ${spec.description} ${paramsText} ${tagsText} ${skillsText} ${rulesText}`
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [specQuery, specTagFilter, specs])

  const filteredEntities = React.useMemo(() => {
    const query = entityQuery.trim().toLowerCase()
    return entities.filter(entity => {
      const tags = entity.tags ?? []
      if (entityTagFilter.length > 0 && !entityTagFilter.every(tag => tags.includes(tag))) return false
      if (query === '') return true
      const tagsText = tags.join(' ')
      const skillsText = (entity.skills ?? []).join(' ')
      const rulesText = (entity.rules ?? []).join(' ')
      const haystack = `${entity.name} ${entity.description} ${tagsText} ${skillsText} ${rulesText}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [entityQuery, entityTagFilter, entities])

  const handleRefresh = async () => {
    await Promise.all([mutateSpecs(), mutateEntities()])
    void message.success(t('knowledge.actions.refreshed'))
  }

  const handleCreateSpec = () => {
    message.info(t('knowledge.flows.createHint'))
  }

  const handleImportSpec = () => {
    message.info(t('knowledge.flows.importHint'))
  }

  const handleCreateEntity = () => {
    message.info(t('knowledge.entities.createHint'))
  }

  const handleImportEntity = () => {
    message.info(t('knowledge.entities.importHint'))
  }

  const handleCreateSkill = () => {
    message.info(t('knowledge.skills.createHint'))
  }

  const handleImportSkill = () => {
    message.info(t('knowledge.skills.importHint'))
  }

  const handleCreateRule = () => {
    message.info(t('knowledge.rules.createHint'))
  }

  const handleImportRule = () => {
    message.info(t('knowledge.rules.importHint'))
  }

  const tabs = [
    {
      key: 'skills',
      label: <TabLabel icon='psychology' label={t('knowledge.tabs.skills')} />,
      children: (
        <SkillsTab
          onCreate={handleCreateSkill}
          onImport={handleImportSkill}
        />
      )
    },
    {
      key: 'entities',
      label: <TabLabel icon='group_work' label={t('knowledge.tabs.entities')} />,
      children: (
        <EntitiesTab
          entities={entities}
          filteredEntities={filteredEntities}
          isLoading={isEntitiesLoading}
          query={entityQuery}
          tagOptions={entityTagOptions}
          tagFilter={entityTagFilter}
          onQueryChange={setEntityQuery}
          onTagFilterChange={setEntityTagFilter}
          onCreate={handleCreateEntity}
          onImport={handleImportEntity}
        />
      )
    },
    {
      key: 'flows',
      label: <TabLabel icon='account_tree' label={t('knowledge.tabs.flows')} />,
      children: (
        <FlowsTab
          specs={specs}
          filteredSpecs={filteredSpecs}
          isLoading={isSpecsLoading}
          query={specQuery}
          tagOptions={specTagOptions}
          tagFilter={specTagFilter}
          onQueryChange={setSpecQuery}
          onTagFilterChange={setSpecTagFilter}
          onCreate={handleCreateSpec}
          onImport={handleImportSpec}
        />
      )
    },
    {
      key: 'rules',
      label: <TabLabel icon='gavel' label={t('knowledge.tabs.rules')} />,
      children: (
        <RulesTab
          onCreate={handleCreateRule}
          onImport={handleImportRule}
        />
      )
    }
  ]

  return (
    <div className='knowledge-base-view'>
      <KnowledgeBaseHeader onRefresh={handleRefresh} />
      <Tabs className='knowledge-base-view__tabs' items={tabs} />
    </div>
  )
}
