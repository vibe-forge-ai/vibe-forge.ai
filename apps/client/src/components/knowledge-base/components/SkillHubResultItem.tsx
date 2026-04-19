import { Button, List, Tag, Tooltip } from 'antd'
import { useTranslation } from 'react-i18next'

import type { SkillHubItem } from '#~/api.js'
import { joinValues } from './skill-hub-utils'

function SkillCapabilityTags({ item }: { item: SkillHubItem }) {
  const { t } = useTranslation()
  const groups = [
    { key: 'skills', icon: 'psychology', items: item.skills },
    { key: 'commands', icon: 'terminal', items: item.commands },
    { key: 'agents', icon: 'groups', items: item.agents },
    { key: 'mcp', icon: 'account_tree', items: item.mcpServers },
    { key: 'hooks', icon: 'bolt', items: item.hasHooks ? [t('knowledge.skills.hooks')] : [] }
  ]

  return (
    <div className='knowledge-base-view__skill-capabilities'>
      {groups.flatMap(group =>
        group.items.map(value => (
          <Tag key={`${group.key}:${value}`} className='knowledge-base-view__skill-capability'>
            <span className='material-symbols-rounded knowledge-base-view__tag-icon'>{group.icon}</span>
            <span>{value}</span>
          </Tag>
        ))
      )}
    </div>
  )
}

export function SkillHubResultItem({
  item,
  installing,
  onInstall
}: {
  item: SkillHubItem
  installing: boolean
  onInstall: (item: SkillHubItem) => void
}) {
  const { t } = useTranslation()
  const subtitle = joinValues([
    item.registry,
    item.version ?? '',
    item.installScope != null ? `${t('knowledge.skills.scope')}: ${item.installScope}` : ''
  ])

  return (
    <List.Item className='knowledge-base-view__list-item'>
      <div className='knowledge-base-view__skill-result'>
        <div className='knowledge-base-view__skill-result-main'>
          <div className='knowledge-base-view__item-title'>
            <span className='material-symbols-rounded knowledge-base-view__item-icon'>extension</span>
            <span>{item.name}</span>
            {item.installed &&
              <Tag className='knowledge-base-view__skill-status'>{t('knowledge.skills.installed')}</Tag>}
          </div>
          {subtitle !== '' && <div className='knowledge-base-view__skill-subtitle'>{subtitle}</div>}
          {item.description != null && item.description.trim() !== '' && (
            <div className='knowledge-base-view__item-desc'>{item.description}</div>
          )}
          <SkillCapabilityTags item={item} />
        </div>
        <Tooltip title={item.installed ? t('knowledge.skills.reinstall') : t('knowledge.skills.install')}>
          <Button
            type={item.installed ? 'default' : 'primary'}
            className='knowledge-base-view__icon-button'
            loading={installing}
            onClick={() => onInstall(item)}
            icon={
              <span className='material-symbols-rounded'>
                {item.installed ? 'sync' : 'download'}
              </span>
            }
          />
        </Tooltip>
      </div>
    </List.Item>
  )
}
