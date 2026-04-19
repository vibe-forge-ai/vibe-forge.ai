import { Empty, List, Spin } from 'antd'
import { useTranslation } from 'react-i18next'

import type { SkillSummary } from '#~/api.js'
import { EmptyState } from './EmptyState'

interface ProjectSkillsListProps {
  allCount: number
  isLoading: boolean
  skills: SkillSummary[]
  onCreate: () => void
}

export function ProjectSkillsList({
  allCount,
  isLoading,
  skills,
  onCreate
}: ProjectSkillsListProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className='knowledge-base-view__loading'>
        <Spin />
      </div>
    )
  }

  if (skills.length === 0 && allCount === 0) {
    return (
      <EmptyState
        description={t('knowledge.skills.empty')}
        actionLabel={t('knowledge.skills.create')}
        onAction={onCreate}
      />
    )
  }

  if (skills.length === 0) {
    return (
      <div className='knowledge-base-view__empty-simple'>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('knowledge.filters.noResults')} />
      </div>
    )
  }

  return (
    <List
      className='knowledge-base-view__list'
      dataSource={skills}
      renderItem={(skill) => (
        <List.Item className='knowledge-base-view__list-item'>
          <div className='knowledge-base-view__skill-result'>
            <div className='knowledge-base-view__skill-result-main'>
              <div className='knowledge-base-view__item-title'>
                <span className='material-symbols-rounded knowledge-base-view__item-icon'>psychology</span>
                <span>{skill.name}</span>
              </div>
              {skill.description.trim() !== '' && (
                <div className='knowledge-base-view__item-desc'>{skill.description}</div>
              )}
              <div className='knowledge-base-view__skill-subtitle'>{skill.id}</div>
            </div>
          </div>
        </List.Item>
      )}
    />
  )
}
