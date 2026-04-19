import './KnowledgeBaseView.scss'

import { App, Form } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import { createSkill, getApiErrorMessage } from '#~/api.js'
import type { EntitySummary, RuleSummary, SkillSummary, SpecSummary } from '#~/api.js'
import { PageShell } from '#~/components/layout/PageShell.js'
import { useResponsiveLayout } from '#~/hooks/use-responsive-layout'
import { useQueryParams } from '#~/hooks/useQueryParams.js'
import { CreateSkillModal } from './components/CreateSkillModal.js'
import type { CreateSkillFormValues } from './components/CreateSkillModal.js'
import { EntitiesTab } from './components/EntitiesTab.js'
import { FlowsTab } from './components/FlowsTab.js'
import { KnowledgeContentControls } from './components/KnowledgeContentControls.js'
import { KnowledgeMobilePanel } from './components/KnowledgeMobilePanel.js'
import { KnowledgeSidebar } from './components/KnowledgeSidebar.js'
import { RulesTab } from './components/RulesTab.js'
import { SkillsTab } from './components/SkillsTab.js'

interface KnowledgeQueryParams extends Record<string, string> {
  kbTab: string
}

export function KnowledgeBaseView() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { isCompactLayout, isTouchInteraction } = useResponsiveLayout()
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
  const {
    data: skillsRes,
    mutate: mutateSkills
  } = useSWR<{ skills: SkillSummary[] }>('/api/ai/skills')

  const specs = specsRes?.specs ?? []
  const entities = entitiesRes?.entities ?? []
  const rules = rulesRes?.rules ?? []

  const [specQuery, setSpecQuery] = React.useState('')
  const [specTagFilter, setSpecTagFilter] = React.useState<string[]>([])
  const [entityQuery, setEntityQuery] = React.useState('')
  const [entityTagFilter, setEntityTagFilter] = React.useState<string[]>([])
  const [ruleQuery, setRuleQuery] = React.useState('')
  const [skillProjectQuery, setSkillProjectQuery] = React.useState('')
  const [skillViewMode, setSkillViewMode] = React.useState<'project' | 'market'>('project')
  const [isKnowledgeSidebarCollapsed, setKnowledgeSidebarCollapsed] = React.useState(false)
  const [isMobileKnowledgePanelOpen, setMobileKnowledgePanelOpen] = React.useState(false)
  const [createSkillOpen, setCreateSkillOpen] = React.useState(false)
  const [savingSkill, setSavingSkill] = React.useState(false)
  const [createSkillForm] = Form.useForm<CreateSkillFormValues>()

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
    await Promise.all([mutateSpecs(), mutateEntities(), mutateRules(), mutateSkills()])
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
    createSkillForm.resetFields()
    setCreateSkillOpen(true)
  }

  const handleSaveSkill = async () => {
    const values = await createSkillForm.validateFields()
    setSavingSkill(true)
    try {
      await createSkill({
        name: values.name,
        description: values.description,
        body: values.body
      })
      setCreateSkillOpen(false)
      createSkillForm.resetFields()
      await mutateSkills()
      void message.success(t('knowledge.skills.createSuccess'))
    } catch (error) {
      void message.error(getApiErrorMessage(error, t('knowledge.skills.createFailed')))
    } finally {
      setSavingSkill(false)
    }
  }

  const handleCreateRule = () => {
    message.info(t('knowledge.rules.createHint'))
  }

  const handleImportRule = () => {
    message.info(t('knowledge.rules.importHint'))
  }

  const isCompactView = isCompactLayout || isTouchInteraction
  const getContentControls = (onCreate: () => void) =>
    isCompactView
      ? (
        <KnowledgeContentControls
          onCreate={onCreate}
          onExpandSidebar={() => setMobileKnowledgePanelOpen(true)}
        />
      )
      : isKnowledgeSidebarCollapsed
      ? (
        <KnowledgeContentControls
          onCreate={onCreate}
          onExpandSidebar={() => setKnowledgeSidebarCollapsed(false)}
        />
      )
      : undefined

  const skillCount = React.useMemo(() => {
    if (skillsRes?.skills != null) return skillsRes.skills.length
    const names = new Set<string>()
    specs.forEach(spec => {
      spec.skills?.forEach(skill => names.add(skill))
    })
    entities.forEach(entity => {
      entity.skills?.forEach(skill => names.add(skill))
    })
    return names.size
  }, [entities, skillsRes?.skills, specs])

  const sections = [
    {
      key: 'skills',
      icon: 'psychology',
      label: t('knowledge.tabs.skills'),
      description: t('knowledge.skills.desc'),
      count: skillCount,
      content: (
        <SkillsTab
          leading={getContentControls(handleCreateSkill)}
          projectQuery={skillProjectQuery}
          viewMode={skillViewMode}
          onRefresh={handleRefresh}
          onCreate={handleCreateSkill}
          onViewModeChange={setSkillViewMode}
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
          hideContentSearch={isCompactView}
          isLoading={isEntitiesLoading}
          leading={getContentControls(handleCreateEntity)}
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
          hideContentSearch={isCompactView}
          isLoading={isSpecsLoading}
          leading={getContentControls(handleCreateSpec)}
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
          hideContentSearch={isCompactView}
          isLoading={isRulesLoading}
          leading={getContentControls(handleCreateRule)}
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
  const activeSearchValue = activeSectionKey === 'skills'
    ? skillProjectQuery
    : activeSectionKey === 'entities'
    ? entityQuery
    : activeSectionKey === 'flows'
    ? specQuery
    : activeSectionKey === 'rules'
    ? ruleQuery
    : ''
  const activeSearchPlaceholder = activeSectionKey === 'skills'
    ? t('knowledge.skills.searchProject')
    : t('knowledge.filters.searchActive')
  const showMobileSearch = !(activeSectionKey === 'skills' && skillViewMode === 'market')

  React.useEffect(() => {
    if (!isCompactView) {
      setMobileKnowledgePanelOpen(false)
    }
  }, [isCompactView])

  const handleActiveSearchChange = (value: string) => {
    if (activeSectionKey === 'skills') {
      setSkillProjectQuery(value)
      return
    }
    if (activeSectionKey === 'entities') {
      setEntityQuery(value)
      return
    }
    if (activeSectionKey === 'flows') {
      setSpecQuery(value)
      return
    }
    if (activeSectionKey === 'rules') {
      setRuleQuery(value)
    }
  }

  const handleSidebarCreate = () => {
    if (isCompactView) {
      setMobileKnowledgePanelOpen(false)
    }

    if (activeSectionKey === 'skills') {
      handleCreateSkill()
      return
    }
    if (activeSectionKey === 'entities') {
      handleCreateEntity()
      return
    }
    if (activeSectionKey === 'flows') {
      handleCreateSpec()
      return
    }
    if (activeSectionKey === 'rules') {
      handleCreateRule()
    }
  }

  const handleSelectSection = (key: string) => {
    update({ kbTab: key })
    if (isCompactView) {
      setMobileKnowledgePanelOpen(false)
    }
  }

  React.useEffect(() => {
    if (values.kbTab !== activeSectionKey) {
      update({ kbTab: activeSectionKey })
    }
  }, [activeSectionKey, update, values.kbTab])

  return (
    <PageShell
      className={`knowledge-base-view ${isCompactView ? 'knowledge-base-view--compact' : ''}`}
      bodyClassName='knowledge-base-view__body'
    >
      {isCompactView
        ? (
          <KnowledgeMobilePanel
            activeKey={activeSectionKey}
            open={isMobileKnowledgePanelOpen}
            searchPlaceholder={activeSearchPlaceholder}
            searchValue={activeSearchValue}
            sections={sections}
            showSearch={showMobileSearch}
            onClose={() => setMobileKnowledgePanelOpen(false)}
            onCreate={handleSidebarCreate}
            onSearchChange={handleActiveSearchChange}
            onSelect={handleSelectSection}
          />
        )
        : (
          <KnowledgeSidebar
            activeKey={activeSectionKey}
            collapsed={isKnowledgeSidebarCollapsed}
            isCompact={isCompactView}
            searchPlaceholder={activeSearchPlaceholder}
            searchValue={activeSearchValue}
            sections={sections}
            onCreate={handleSidebarCreate}
            onSearchChange={handleActiveSearchChange}
            onSelect={handleSelectSection}
            onToggleCollapsed={() => setKnowledgeSidebarCollapsed(prev => !prev)}
          />
        )}
      <div className='knowledge-base-view__right'>
        <div className='knowledge-base-view__right-body'>{activeSection?.content}</div>
      </div>
      <CreateSkillModal
        open={createSkillOpen}
        saving={savingSkill}
        form={createSkillForm}
        onSave={() => void handleSaveSkill()}
        onClose={() => setCreateSkillOpen(false)}
      />
    </PageShell>
  )
}
