import './SpecItem.scss'

import { Button, Empty, Popover, Tag, Tooltip } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import type { SpecDetail, SpecSummary } from '#~/api.js'
import { getSpecDetail } from '#~/api.js'
import { MarkdownContent } from '#~/components/chat/MarkdownContent'
import { LoadingState } from './LoadingState'
import { MetaList } from './MetaList'

type SpecItemProps = {
  spec: SpecSummary
}

export function SpecItem({ spec }: SpecItemProps) {
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
              content={<MetaList items={skills} />}
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
              content={<MetaList items={rules} />}
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
          {isLoading && <LoadingState />}
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
