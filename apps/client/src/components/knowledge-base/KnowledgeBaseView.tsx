import './KnowledgeBaseView.scss'

import { App } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import type { EntitySummary, RuleSummary, SpecSummary } from '#~/api.js'
import { PageShell } from '#~/components/layout/PageShell.js'
import { useQueryParams } from '#~/hooks/useQueryParams.js'
import { EntitiesTab } from './components/EntitiesTab.js'
import { FlowsTab } from './components/FlowsTab.js'
import { RulesTab } from './components/RulesTab.js'
import { SkillsTab } from './components/SkillsTab.js'

interface KnowledgeQueryParams extends Record<string, string> {
  kbTab: string
}

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
  const {
    data: rulesRes,
    isLoading: isRulesLoading,
    mutate: mutateRules
  } = useSWR<{ rules: RuleSummary[] }>('/api/ai/rules')

  const specs = specsRes?.specs ?? []
  const entities = entitiesRes?.entities ?? []
  const rules = rulesRes?.rules ?? []

  const [specQuery, setSpecQuery] = React.useState('')
  const [specTagFilter, setSpecTagFilter] = React.useState<string[]>([])
  const [entityQuery, setEntityQuery] = React.useState('')
  const [entityTagFilter, setEntityTagFilter] = React.useState<string[]>([])
  const [ruleQuery, setRuleQuery] = React.useState('')

  const { values, update } = useQueryParams<KnowledgeQueryParams>({
    keys: ['kbTab'],
    defaults: {
      kbTab: 'skills'
    }
  })

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

  const filteredRules = React.useMemo(() => {
    const query = ruleQuery.trim().toLowerCase()
    return rules.filter(rule => {
      if (query === '') return true
      const globText = (rule.globs ?? []).join(' ')
      const haystack = `${rule.name} ${rule.description} ${globText}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [ruleQuery, rules])

  const handleRefresh = async () => {
    await Promise.all([mutateSpecs(), mutateEntities(), mutateRules()])
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

  const skillCount = React.useMemo(() => {
    const names = new Set<string>()
    specs.forEach(spec => {
      spec.skills?.forEach(skill => names.add(skill))
    })
    entities.forEach(entity => {
      entity.skills?.forEach(skill => names.add(skill))
    })
    return names.size
  }, [entities, specs])

  const sections = [
    {
      key: 'skills',
      icon: 'psychology',
      label: t('knowledge.tabs.skills'),
      description: t('knowledge.skills.desc'),
      count: skillCount,
      content: (
        <SkillsTab
          onRefresh={handleRefresh}
          onCreate={handleCreateSkill}
          onImport={handleImportSkill}
        />
      )
    },
    {
      key: 'entities',
      icon: 'group_work',
      label: t('knowledge.tabs.entities'),
      description: t('knowledge.entities.desc'),
      count: entities.length,
      content: (
        <EntitiesTab
          entities={entities}
          filteredEntities={filteredEntities}
          isLoading={isEntitiesLoading}
          query={entityQuery}
          tagOptions={entityTagOptions}
          tagFilter={entityTagFilter}
          onRefresh={handleRefresh}
          onQueryChange={setEntityQuery}
          onTagFilterChange={setEntityTagFilter}
          onCreate={handleCreateEntity}
          onImport={handleImportEntity}
        />
      )
    },
    {
      key: 'flows',
      icon: 'account_tree',
      label: t('knowledge.tabs.flows'),
      description: t('knowledge.flows.desc'),
      count: specs.length,
      content: (
        <FlowsTab
          specs={specs}
          filteredSpecs={filteredSpecs}
          isLoading={isSpecsLoading}
          query={specQuery}
          tagOptions={specTagOptions}
          tagFilter={specTagFilter}
          onRefresh={handleRefresh}
          onQueryChange={setSpecQuery}
          onTagFilterChange={setSpecTagFilter}
          onCreate={handleCreateSpec}
          onImport={handleImportSpec}
        />
      )
    },
    {
      key: 'rules',
      icon: 'gavel',
      label: t('knowledge.tabs.rules'),
      description: t('knowledge.rules.desc'),
      count: rules.length,
      content: (
        <RulesTab
          rules={rules}
          filteredRules={filteredRules}
          isLoading={isRulesLoading}
          query={ruleQuery}
          onRefresh={handleRefresh}
          onQueryChange={setRuleQuery}
          onCreate={handleCreateRule}
          onImport={handleImportRule}
        />
      )
    }
  ]

  const sectionKeys = React.useMemo(() => sections.map(section => section.key), [sections])
  const activeSectionKey = sectionKeys.includes(values.kbTab) ? values.kbTab : sectionKeys[0]
  const activeSection = React.useMemo(
    () => sections.find(section => section.key === activeSectionKey) ?? sections[0],
    [activeSectionKey, sections]
  )

  React.useEffect(() => {
    if (values.kbTab !== activeSectionKey) {
      update({ kbTab: activeSectionKey })
    }
  }, [activeSectionKey, update, values.kbTab])

  return (
    <PageShell
      className='knowledge-base-view'
      bodyClassName='knowledge-base-view__body'
    >
      <div className='knowledge-base-view__left'>
        <div className='knowledge-base-view__sidebar'>
          <div className='knowledge-base-view__nav-list'>
            {sections.map((section) => (
              <button
                key={section.key}
                type='button'
                className={`knowledge-base-view__nav-item ${section.key === activeSectionKey ? 'is-active' : ''}`}
                onClick={() => update({ kbTab: section.key })}
              >
                <span className='material-symbols-rounded knowledge-base-view__nav-icon'>{section.icon}</span>
                <span className='knowledge-base-view__nav-main'>
                  <span className='knowledge-base-view__nav-row'>
                    <span className='knowledge-base-view__nav-label'>{section.label}</span>
                    <span className='knowledge-base-view__nav-count'>{section.count}</span>
                  </span>
                  <span className='knowledge-base-view__nav-desc'>{section.description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className='knowledge-base-view__right'>
        <div className='knowledge-base-view__right-body'>{activeSection?.content}</div>
      </div>
    </PageShell>
  )
}
