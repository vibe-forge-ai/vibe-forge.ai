import './EntityItem.scss'

import { Button, Popover, Tag } from 'antd'
import { useTranslation } from 'react-i18next'

import type { EntitySummary } from '#~/api.js'
import { MetaList } from './MetaList'

type EntityItemProps = {
  entity: EntitySummary
}

export function EntityItem({ entity }: EntityItemProps) {
  const { t } = useTranslation()
  const tags = entity.tags ?? []
  const skills = entity.skills ?? []
  const rules = entity.rules ?? []

  return (
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
        </div>
      </div>
    </div>
  )
}
