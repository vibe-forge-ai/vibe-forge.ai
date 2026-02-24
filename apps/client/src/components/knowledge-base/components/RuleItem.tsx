import { Button, Empty, Tag, Tooltip } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import type { RuleDetail, RuleSummary } from '#~/api.js'
import { getRuleDetail } from '#~/api.js'
import { MarkdownContent } from '#~/components/chat/MarkdownContent'
import { LoadingState } from './LoadingState'

type RuleItemProps = {
  rule: RuleSummary
}

export function RuleItem({ rule }: RuleItemProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = React.useState(false)
  const { data, isLoading } = useSWR<{ rule: RuleDetail }>(
    expanded ? ['rule-detail', rule.id] : null,
    () => getRuleDetail(rule.id)
  )
  const detail = data?.rule
  const body = detail?.body ?? ''
  const globList = rule.globs ?? []

  return (
    <div className='knowledge-base-view__item'>
      <div className='knowledge-base-view__item-row'>
        <div className='knowledge-base-view__item-main'>
          <div className='knowledge-base-view__item-title'>
            <span className='material-symbols-rounded knowledge-base-view__item-icon'>gavel</span>
            <span>{rule.name}</span>
          </div>
          <div className='knowledge-base-view__item-desc'>{rule.description}</div>
          {globList.length > 0 && (
            <div className='knowledge-base-view__tag-list'>
              {globList.map(glob => (
                <Tag key={glob} className='knowledge-base-view__tag'>
                  <span className='material-symbols-rounded knowledge-base-view__tag-icon'>folder</span>
                  <span>{glob}</span>
                </Tag>
              ))}
            </div>
          )}
        </div>
        <div className='knowledge-base-view__item-meta'>
          {rule.always && (
            <Tag color='blue'>{t('knowledge.meta.always')}</Tag>
          )}
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
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('knowledge.rules.empty')} />
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
