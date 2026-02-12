import './KnowledgeBaseView.scss'

import { App, Button, Empty, Input, List, Popover, Select, Space, Spin, Tabs, Tag, Tooltip } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import type { EntitySummary, SpecDetail, SpecSummary } from '#~/api'
import { getSpecDetail } from '#~/api'
import { MarkdownContent } from '#~/components/chat/MarkdownContent'

function SpecItem({
  spec
}: {
  spec: SpecSummary
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = React.useState(false)
  const { data, isLoading } = useSWR<{ spec: SpecDetail }>(
    expanded ? ['spec-detail', spec.id] : null,
    () => getSpecDetail(spec.id)
  )
  const detail = data?.spec
  const body = detail?.body ?? ''
  const tags = spec.tags ?? []
  const skills = spec.skills ?? []
  const rules = spec.rules ?? []

  const renderMetaList = (items: string[]) => (
    <div className='knowledge-base-view__meta-list'>
      {items.map(item => (
        <div key={item} className='knowledge-base-view__meta-item'>
          <span className='material-symbols-rounded knowledge-base-view__meta-item-icon'>check_circle</span>
          <span>{item}</span>
        </div>
      ))}
    </div>
  )

  return (
    <div className='knowledge-base-view__item'>
      <div className='knowledge-base-view__item-row'>
        <div className='knowledge-base-view__item-main'>
          <div className='knowledge-base-view__item-title'>
            <span className='material-symbols-rounded knowledge-base-view__item-icon'>account_tree</span>
            <span>{spec.name}</span>
          </div>
          <div className='knowledge-base-view__item-desc'>{spec.description}</div>
          {spec.params.length > 0 && (
            <div className='knowledge-base-view__params'>
              {spec.params.map(param => (
                <div key={param.name} className='knowledge-base-view__param'>
                  <span className='material-symbols-rounded knowledge-base-view__param-icon'>tune</span>
                  <div className='knowledge-base-view__param-text'>
                    <span className='knowledge-base-view__param-name'>{param.name}</span>
                    {param.description && (
                      <span className='knowledge-base-view__param-desc'>{param.description}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {tags.length > 0 && (
            <div className='knowledge-base-view__tag-list'>
              {tags.map(tag => (
                <Tag key={tag} className='knowledge-base-view__tag'>
                  <span className='material-symbols-rounded knowledge-base-view__tag-icon'>sell</span>
                  <span>{tag}</span>
                </Tag>
              ))}
            </div>
          )}
        </div>
        <div className='knowledge-base-view__item-meta'>
          {spec.always && (
            <Tag color='blue'>{t('knowledge.meta.always')}</Tag>
          )}
          <div className='knowledge-base-view__meta-pills'>
            <Popover
              content={renderMetaList(skills)}
              title={t('knowledge.meta.skills')}
              trigger='click'
              placement='bottomRight'
            >
              <Button
                type='text'
                className='knowledge-base-view__meta-pill'
                disabled={skills.length === 0}
              >
                <span className='material-symbols-rounded knowledge-base-view__meta-pill-icon'>psychology</span>
                <span>{t('knowledge.meta.skillsCount', { count: skills.length })}</span>
              </Button>
            </Popover>
            <Popover
              content={renderMetaList(rules)}
              title={t('knowledge.meta.rules')}
              trigger='click'
              placement='bottomRight'
            >
              <Button
                type='text'
                className='knowledge-base-view__meta-pill'
                disabled={rules.length === 0}
              >
                <span className='material-symbols-rounded knowledge-base-view__meta-pill-icon'>gavel</span>
                <span>{t('knowledge.meta.rulesCount', { count: rules.length })}</span>
              </Button>
            </Popover>
          </div>
          <Tooltip title={expanded ? t('knowledge.actions.collapse') : t('knowledge.actions.expand')}>
            <Button
              type='text'
              className='knowledge-base-view__icon-button'
              onClick={() => setExpanded(prev => !prev)}
              icon={
                <span className='material-symbols-rounded'>
                  {expanded ? 'expand_less' : 'expand_more'}
                </span>
              }
            />
          </Tooltip>
        </div>
      </div>
      {expanded && (
        <div className='knowledge-base-view__detail'>
          {isLoading && (
            <div className='knowledge-base-view__loading'>
              <Spin />
            </div>
          )}
          {!isLoading && body.trim() === '' && (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('knowledge.flows.noContent')} />
          )}
          {!isLoading && body.trim() !== '' && (
            <div className='knowledge-base-view__markdown'>
              <MarkdownContent content={body} />
            </div>
          )}
        </div>
      )}
    </div>
  )
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
      const haystack = `${spec.name} ${spec.description} ${paramsText} ${tagsText} ${skillsText} ${rulesText}`.toLowerCase()
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

  const renderEmpty = (description: string, actionLabel: string, onAction: () => void) => (
    <div className='knowledge-base-view__empty'>
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description} />
      <Button
        type='primary'
        className='knowledge-base-view__action-button'
        icon={<span className='material-symbols-rounded'>add_circle</span>}
        onClick={onAction}
      >
        {actionLabel}
      </Button>
    </div>
  )

  const renderSpecList = () => {
    if (isSpecsLoading) {
      return (
        <div className='knowledge-base-view__loading'>
          <Spin />
        </div>
      )
    }

    if (specs.length === 0) {
      return renderEmpty(
        t('knowledge.flows.empty'),
        t('knowledge.flows.create'),
        handleCreateSpec
      )
    }

    if (filteredSpecs.length === 0) {
      return (
        <div className='knowledge-base-view__empty-simple'>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('knowledge.filters.noResults')} />
        </div>
      )
    }

    return (
      <List
        className='knowledge-base-view__list'
        dataSource={filteredSpecs}
        renderItem={(spec) => (
          <List.Item className='knowledge-base-view__list-item'>
            <SpecItem spec={spec} />
          </List.Item>
        )}
      />
    )
  }

  const renderEntityList = () => {
    if (isEntitiesLoading) {
      return (
        <div className='knowledge-base-view__loading'>
          <Spin />
        </div>
      )
    }

    if (entities.length === 0) {
      return renderEmpty(
        t('knowledge.entities.empty'),
        t('knowledge.entities.create'),
        handleCreateEntity
      )
    }

    if (filteredEntities.length === 0) {
      return (
        <div className='knowledge-base-view__empty-simple'>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('knowledge.filters.noResults')} />
        </div>
      )
    }

    return (
      <List
        className='knowledge-base-view__list'
        dataSource={filteredEntities}
        renderItem={(entity) => {
          const tags = entity.tags ?? []
          const skills = entity.skills ?? []
          const rules = entity.rules ?? []
          const renderMetaList = (items: string[]) => (
            <div className='knowledge-base-view__meta-list'>
              {items.map(item => (
                <div key={item} className='knowledge-base-view__meta-item'>
                  <span className='material-symbols-rounded knowledge-base-view__meta-item-icon'>check_circle</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          )
          return (
            <List.Item className='knowledge-base-view__list-item'>
              <div className='knowledge-base-view__item'>
                <div className='knowledge-base-view__item-row'>
                  <div className='knowledge-base-view__item-main'>
                    <div className='knowledge-base-view__item-title'>
                      <span className='material-symbols-rounded knowledge-base-view__item-icon'>group_work</span>
                      <span>{entity.name}</span>
                    </div>
                    <div className='knowledge-base-view__item-desc'>{entity.description}</div>
                    {tags.length > 0 && (
                      <div className='knowledge-base-view__tag-list'>
                        {tags.map(tag => (
                          <Tag key={tag} className='knowledge-base-view__tag'>
                            <span className='material-symbols-rounded knowledge-base-view__tag-icon'>sell</span>
                            <span>{tag}</span>
                          </Tag>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className='knowledge-base-view__item-meta'>
                    {entity.always && (
                      <Tag color='blue'>{t('knowledge.meta.always')}</Tag>
                    )}
                    <div className='knowledge-base-view__meta-pills'>
                      <Popover
                        content={renderMetaList(skills)}
                        title={t('knowledge.meta.skills')}
                        trigger='click'
                        placement='bottomRight'
                      >
                        <Button
                          type='text'
                          className='knowledge-base-view__meta-pill'
                          disabled={skills.length === 0}
                        >
                          <span className='material-symbols-rounded knowledge-base-view__meta-pill-icon'>
                            psychology
                          </span>
                          <span>{t('knowledge.meta.skillsCount', { count: skills.length })}</span>
                        </Button>
                      </Popover>
                      <Popover
                        content={renderMetaList(rules)}
                        title={t('knowledge.meta.rules')}
                        trigger='click'
                        placement='bottomRight'
                      >
                        <Button
                          type='text'
                          className='knowledge-base-view__meta-pill'
                          disabled={rules.length === 0}
                        >
                          <span className='material-symbols-rounded knowledge-base-view__meta-pill-icon'>gavel</span>
                          <span>{t('knowledge.meta.rulesCount', { count: rules.length })}</span>
                        </Button>
                      </Popover>
                    </div>
                  </div>
                </div>
              </div>
            </List.Item>
          )
        }}
      />
    )
  }

  const renderSkillList = () => renderEmpty(
    t('knowledge.skills.empty'),
    t('knowledge.skills.create'),
    handleCreateSkill
  )

  const renderRuleList = () => renderEmpty(
    t('knowledge.rules.empty'),
    t('knowledge.rules.create'),
    handleCreateRule
  )

  const tabs = [
    {
      key: 'skills',
      label: (
        <span className='knowledge-base-view__tab-label'>
          <span className='material-symbols-rounded knowledge-base-view__tab-icon'>psychology</span>
          <span>{t('knowledge.tabs.skills')}</span>
        </span>
      ),
      children: (
        <div className='knowledge-base-view__content'>
          <div className='knowledge-base-view__section-header'>
            <div className='knowledge-base-view__section-info'>
              <div className='knowledge-base-view__section-title'>{t('knowledge.skills.title')}</div>
              <div className='knowledge-base-view__section-desc'>{t('knowledge.skills.desc')}</div>
            </div>
            <Space>
              <Button
                className='knowledge-base-view__action-button'
                icon={<span className='material-symbols-rounded'>download</span>}
                onClick={handleImportSkill}
              >
                {t('knowledge.actions.import')}
              </Button>
              <Button
                type='primary'
                className='knowledge-base-view__action-button'
                icon={<span className='material-symbols-rounded'>add_circle</span>}
                onClick={handleCreateSkill}
              >
                {t('knowledge.skills.create')}
              </Button>
            </Space>
          </div>
          {renderSkillList()}
        </div>
      )
    },
    {
      key: 'entities',
      label: (
        <span className='knowledge-base-view__tab-label'>
          <span className='material-symbols-rounded knowledge-base-view__tab-icon'>group_work</span>
          <span>{t('knowledge.tabs.entities')}</span>
        </span>
      ),
      children: (
        <div className='knowledge-base-view__content'>
          <div className='knowledge-base-view__section-header'>
            <div className='knowledge-base-view__section-info'>
              <div className='knowledge-base-view__section-title'>{t('knowledge.entities.title')}</div>
              <div className='knowledge-base-view__section-desc'>{t('knowledge.entities.desc')}</div>
            </div>
            <Space>
              <Button
                className='knowledge-base-view__action-button'
                icon={<span className='material-symbols-rounded'>download</span>}
                onClick={handleImportEntity}
              >
                {t('knowledge.actions.import')}
              </Button>
              <Button
                type='primary'
                className='knowledge-base-view__action-button'
                icon={<span className='material-symbols-rounded'>add_circle</span>}
                onClick={handleCreateEntity}
              >
                {t('knowledge.entities.create')}
              </Button>
            </Space>
          </div>
          <div className='knowledge-base-view__filters'>
            <Input
              className='knowledge-base-view__filter-input'
              prefix={<span className='material-symbols-rounded knowledge-base-view__filter-icon'>search</span>}
              placeholder={t('knowledge.filters.search')}
              allowClear
              value={entityQuery}
              onChange={(e) => setEntityQuery(e.target.value)}
            />
            <Select
              className='knowledge-base-view__filter-select'
              mode='multiple'
              placeholder={t('knowledge.filters.tags')}
              options={entityTagOptions}
              value={entityTagFilter}
              onChange={setEntityTagFilter}
              maxTagCount='responsive'
              disabled={entityTagOptions.length === 0}
            />
          </div>
          {renderEntityList()}
        </div>
      )
    },
    {
      key: 'flows',
      label: (
        <span className='knowledge-base-view__tab-label'>
          <span className='material-symbols-rounded knowledge-base-view__tab-icon'>account_tree</span>
          <span>{t('knowledge.tabs.flows')}</span>
        </span>
      ),
      children: (
        <div className='knowledge-base-view__content'>
          <div className='knowledge-base-view__section-header'>
            <div className='knowledge-base-view__section-info'>
              <div className='knowledge-base-view__section-title'>{t('knowledge.flows.title')}</div>
              <div className='knowledge-base-view__section-desc'>{t('knowledge.flows.desc')}</div>
            </div>
            <Space>
              <Button
                className='knowledge-base-view__action-button'
                icon={<span className='material-symbols-rounded'>download</span>}
                onClick={handleImportSpec}
              >
                {t('knowledge.actions.import')}
              </Button>
              <Button
                type='primary'
                className='knowledge-base-view__action-button'
                icon={<span className='material-symbols-rounded'>add_circle</span>}
                onClick={handleCreateSpec}
              >
                {t('knowledge.flows.create')}
              </Button>
            </Space>
          </div>
          <div className='knowledge-base-view__filters'>
            <Input
              className='knowledge-base-view__filter-input'
              prefix={<span className='material-symbols-rounded knowledge-base-view__filter-icon'>search</span>}
              placeholder={t('knowledge.filters.search')}
              allowClear
              value={specQuery}
              onChange={(e) => setSpecQuery(e.target.value)}
            />
            <Select
              className='knowledge-base-view__filter-select'
              mode='multiple'
              placeholder={t('knowledge.filters.tags')}
              options={specTagOptions}
              value={specTagFilter}
              onChange={setSpecTagFilter}
              maxTagCount='responsive'
              disabled={specTagOptions.length === 0}
            />
          </div>
          {renderSpecList()}
        </div>
      )
    },
    {
      key: 'rules',
      label: (
        <span className='knowledge-base-view__tab-label'>
          <span className='material-symbols-rounded knowledge-base-view__tab-icon'>gavel</span>
          <span>{t('knowledge.tabs.rules')}</span>
        </span>
      ),
      children: (
        <div className='knowledge-base-view__content'>
          <div className='knowledge-base-view__section-header'>
            <div className='knowledge-base-view__section-info'>
              <div className='knowledge-base-view__section-title'>{t('knowledge.rules.title')}</div>
              <div className='knowledge-base-view__section-desc'>{t('knowledge.rules.desc')}</div>
            </div>
            <Space>
              <Button
                className='knowledge-base-view__action-button'
                icon={<span className='material-symbols-rounded'>download</span>}
                onClick={handleImportRule}
              >
                {t('knowledge.actions.import')}
              </Button>
              <Button
                type='primary'
                className='knowledge-base-view__action-button'
                icon={<span className='material-symbols-rounded'>add_circle</span>}
                onClick={handleCreateRule}
              >
                {t('knowledge.rules.create')}
              </Button>
            </Space>
          </div>
          {renderRuleList()}
        </div>
      )
    }
  ]

  return (
    <div className='knowledge-base-view'>
      <div className='knowledge-base-view__header'>
        <div className='knowledge-base-view__title'>
          <span className='material-symbols-rounded knowledge-base-view__title-icon'>library_books</span>
          <div className='knowledge-base-view__title-text'>
            <div className='knowledge-base-view__title-main'>{t('knowledge.title')}</div>
            <div className='knowledge-base-view__subtitle'>{t('knowledge.subtitle')}</div>
          </div>
        </div>
        <Button
          className='knowledge-base-view__action-button'
          icon={<span className='material-symbols-rounded'>refresh</span>}
          onClick={() => void handleRefresh()}
        >
          {t('knowledge.actions.refresh')}
        </Button>
      </div>
      <Tabs className='knowledge-base-view__tabs' items={tabs} />
    </div>
  )
}
