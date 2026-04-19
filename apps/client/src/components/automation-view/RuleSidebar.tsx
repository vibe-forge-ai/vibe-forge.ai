import './RuleSidebar.scss'

import { Button, Dropdown, Empty, List, Switch, Tag, Tooltip } from 'antd'
import type { MenuProps } from 'antd'
import dayjs from 'dayjs'
import React, { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { AutomationRule } from '#~/api.js'
import { SidebarListHeader, SidebarListSearchInput } from '#~/components/sidebar-list/SidebarListHeader'
import { useResponsiveLayout } from '#~/hooks/use-responsive-layout'

interface RuleSidebarProps {
  rules: AutomationRule[]
  selectedRuleId: string | null
  query: string
  isCreating: boolean
  favoriteIds: string[]
  collapsible?: boolean
  onCreate: () => void
  onSelect: (id: string) => void
  onRun: (rule: AutomationRule) => void
  onDelete: (rule: AutomationRule) => void
  onToggleFavorite: (ruleId: string) => void
  onToggle: (rule: AutomationRule, enabled: boolean) => void
  onToggleCollapsed?: () => void
  onQueryChange: (value: string) => void
}

export function RuleSidebar({
  rules,
  selectedRuleId,
  query,
  isCreating,
  favoriteIds,
  collapsible = false,
  onCreate,
  onSelect,
  onRun,
  onDelete,
  onToggleFavorite,
  onToggle,
  onToggleCollapsed,
  onQueryChange
}: RuleSidebarProps) {
  const { t } = useTranslation()
  const { isCompactLayout, isTouchInteraction } = useResponsiveLayout()
  const isCompactHeader = isCompactLayout || isTouchInteraction
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds])
  const filteredRules = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const list = keyword
      ? rules.filter(rule => {
        const nameMatch = rule.name.toLowerCase().includes(keyword)
        const descMatch = (rule.description ?? '').toLowerCase().includes(keyword)
        return nameMatch || descMatch
      })
      : rules
    return [...list].sort((a, b) => {
      const favA = favoriteSet.has(a.id) ? 1 : 0
      const favB = favoriteSet.has(b.id) ? 1 : 0
      if (favA !== favB) return favB - favA
      return b.createdAt - a.createdAt
    })
  }, [favoriteSet, query, rules])

  const renderTriggerBadge = useCallback((trigger: NonNullable<AutomationRule['triggers']>[number]) => {
    if (trigger.type === 'interval') {
      const minutes = trigger.intervalMs ? Math.max(1, Math.round(trigger.intervalMs / 60000)) : 0
      return (
        <span className='automation-view__trigger-chip'>
          <span className='material-symbols-rounded automation-view__trigger-icon'>timer</span>
          {t('automation.intervalEvery', { minutes })}
        </span>
      )
    }
    if (trigger.type === 'cron') {
      return (
        <span className='automation-view__trigger-chip'>
          <span className='material-symbols-rounded automation-view__trigger-icon'>schedule</span>
          {t('automation.cronExpression', { expression: trigger.cronExpression ?? '-' })}
        </span>
      )
    }
    return (
      <span className='automation-view__trigger-chip'>
        <span className='material-symbols-rounded automation-view__trigger-icon'>webhook</span>
        {t('automation.webhookTrigger')}
      </span>
    )
  }, [t])

  return (
    <div className='automation-view__sidebar'>
      <SidebarListHeader
        className='automation-view__sidebar-header'
        compact={isCompactHeader}
        primaryAction={
          <Button
            className={`sidebar-list-header__primary-action automation-view__new-rule-button ${
              isCreating ? 'active' : ''
            }`}
            type={isCreating ? 'default' : 'primary'}
            block
            onClick={onCreate}
            disabled={isCreating}
          >
            <span className='sidebar-list-header__button-content'>
              <span className={`material-symbols-rounded ${isCreating ? 'filled' : ''}`}>
                {isCreating ? 'progress_activity' : 'add'}
              </span>
              <span>{isCreating ? t('automation.creatingRule') : t('automation.newRule')}</span>
            </span>
          </Button>
        }
        sideAction={collapsible
          ? (
            <Tooltip
              title={isTouchInteraction
                ? undefined
                : isCompactHeader
                ? t('common.close')
                : t('automation.collapseRulePanel')}
            >
              <Button
                className='sidebar-list-header__icon-action automation-view__sidebar-collapse-button'
                type='text'
                aria-label={isCompactHeader ? t('common.close') : t('automation.collapseRulePanel')}
                onClick={onToggleCollapsed}
              >
                <span className='material-symbols-rounded'>{isCompactHeader ? 'close' : 'left_panel_close'}</span>
              </Button>
            </Tooltip>
          )
          : undefined}
      >
        <SidebarListSearchInput
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t('automation.searchRule')}
          className='automation-view__sidebar-search-input'
          allowClear
        />
      </SidebarListHeader>

      {filteredRules.length === 0
        ? (
          <div className='automation-view__empty'>
            <Empty description={t('automation.emptyRules')} />
          </div>
        )
        : (
          <List
            className='automation-view__rule-list'
            dataSource={filteredRules}
            renderItem={(rule) => {
              const active = rule.id === selectedRuleId
              const isFavorite = favoriteSet.has(rule.id)
              const triggers = rule.triggers ?? []
              const displayTriggers = triggers.slice(0, 2)
              const remainingTriggers = Math.max(triggers.length - displayTriggers.length, 0)
              const taskCount = rule.tasks?.length ?? 0
              const primaryType = triggers[0]?.type ?? 'interval'
              const actionMenuItems: MenuProps['items'] = [
                {
                  key: 'run',
                  label: t('automation.run'),
                  icon: <span className='material-symbols-rounded automation-view__dropdown-icon'>play_arrow</span>
                },
                {
                  key: 'favorite',
                  label: isFavorite ? t('automation.unfavorite') : t('automation.favorite'),
                  icon: (
                    <span
                      className={`material-symbols-rounded automation-view__dropdown-icon ${
                        isFavorite ? 'automation-view__dropdown-icon--active' : ''
                      }`}
                    >
                      {isFavorite ? 'star' : 'star_outline'}
                    </span>
                  )
                },
                {
                  key: 'delete',
                  label: t('automation.delete'),
                  danger: true,
                  icon: <span className='material-symbols-rounded automation-view__dropdown-icon'>delete</span>
                }
              ]
              const handleActionMenuClick: NonNullable<MenuProps['onClick']> = ({ key, domEvent }) => {
                domEvent.stopPropagation()
                if (key === 'run') {
                  void onRun(rule)
                  return
                }
                if (key === 'favorite') {
                  onToggleFavorite(rule.id)
                  return
                }
                if (key === 'delete') {
                  void onDelete(rule)
                }
              }
              return (
                <List.Item
                  className={`automation-view__rule-item ${active ? 'automation-view__rule-item--active' : ''} ${
                    isCompactHeader ? 'automation-view__rule-item--touch' : ''
                  }`}
                  onClick={() => onSelect(rule.id)}
                >
                  <div className='automation-view__rule-card'>
                    <div className='automation-view__rule-content'>
                      <div className='automation-view__rule-name'>
                        <span
                          className={`material-symbols-rounded automation-view__rule-icon automation-view__rule-icon--${primaryType}`}
                        >
                          {primaryType === 'interval' ? 'timer' : primaryType === 'cron' ? 'schedule' : 'webhook'}
                        </span>
                        <span className='automation-view__rule-title'>{rule.name}</span>
                        <Tag
                          color={primaryType === 'interval' ? 'blue' : primaryType === 'cron' ? 'geekblue' : 'purple'}
                        >
                          {primaryType === 'interval'
                            ? t('automation.typeInterval')
                            : primaryType === 'cron'
                            ? t('automation.typeCron')
                            : t('automation.typeWebhook')}
                        </Tag>
                      </div>
                      <div className='automation-view__rule-meta'>
                        <div className='automation-view__rule-trigger-list'>
                          <span className='material-symbols-rounded automation-view__meta-icon'>bolt</span>
                          {displayTriggers.map(trigger => (
                            <span key={trigger.id}>{renderTriggerBadge(trigger)}</span>
                          ))}
                          {remainingTriggers > 0 && (
                            <span className='automation-view__trigger-more'>+{remainingTriggers}</span>
                          )}
                        </div>
                        <span className='automation-view__rule-tasks'>
                          <span className='material-symbols-rounded automation-view__meta-icon'>checklist</span>
                          {t('automation.taskCount', { count: taskCount })}
                        </span>
                      </div>
                    </div>
                    <div className='automation-view__rule-actions'>
                      <div className='automation-view__rule-actions-top'>
                        <Tooltip title={t('automation.toggleEnabled')}>
                          <Switch
                            checked={rule.enabled}
                            onChange={(next) => void onToggle(rule, next)}
                            onClick={(_, event) => event.stopPropagation()}
                          />
                        </Tooltip>
                      </div>
                      <div className='automation-view__rule-actions-bottom'>
                        {isCompactHeader
                          ? (
                            <Dropdown
                              trigger={['click']}
                              menu={{ items: actionMenuItems, onClick: handleActionMenuClick }}
                            >
                              <Button
                                className='automation-view__icon-button automation-view__icon-button--more'
                                type='text'
                                aria-label={t('common.moreActions')}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <span className='material-symbols-rounded automation-view__action-icon'>
                                  more_horiz
                                </span>
                              </Button>
                            </Dropdown>
                          )
                          : (
                            <>
                              <Tooltip title={t('automation.run')}>
                                <Button
                                  className='automation-view__icon-button automation-view__icon-button--run'
                                  type='text'
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void onRun(rule)
                                  }}
                                >
                                  <span className='material-symbols-rounded automation-view__action-icon'>
                                    play_arrow
                                  </span>
                                </Button>
                              </Tooltip>
                              <Tooltip title={isFavorite ? t('automation.unfavorite') : t('automation.favorite')}>
                                <Button
                                  className={`automation-view__icon-button automation-view__icon-button--favorite ${
                                    isFavorite ? 'automation-view__icon-button--active' : ''
                                  }`}
                                  type='text'
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    onToggleFavorite(rule.id)
                                  }}
                                >
                                  <span
                                    className={`material-symbols-rounded automation-view__action-icon ${
                                      isFavorite ? 'automation-view__action-icon--star' : ''
                                    }`}
                                  >
                                    {isFavorite ? 'star' : 'star_outline'}
                                  </span>
                                </Button>
                              </Tooltip>
                              <Tooltip title={t('automation.delete')}>
                                <Button
                                  className='automation-view__icon-button automation-view__icon-button--delete'
                                  type='text'
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void onDelete(rule)
                                  }}
                                >
                                  <span className='material-symbols-rounded automation-view__action-icon'>delete</span>
                                </Button>
                              </Tooltip>
                            </>
                          )}
                      </div>
                      <span className='automation-view__rule-created-at'>
                        {dayjs(rule.createdAt).format('YYYY-MM-DD HH:mm')}
                      </span>
                    </div>
                  </div>
                </List.Item>
              )
            }}
          />
        )}
    </div>
  )
}
