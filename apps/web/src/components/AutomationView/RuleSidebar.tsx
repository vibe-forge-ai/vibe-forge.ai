import './RuleSidebar.scss'

import { Button, Empty, Input, List, Switch, Tag, Tooltip } from 'antd'
import dayjs from 'dayjs'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { AutomationRule } from '#~/api.js'

type RuleSidebarProps = {
  rules: AutomationRule[]
  selectedRuleId: string | null
  query: string
  isCreating: boolean
  onCreate: () => void
  onSelect: (id: string) => void
  onRun: (rule: AutomationRule) => void
  onDelete: (rule: AutomationRule) => void
  onToggle: (rule: AutomationRule, enabled: boolean) => void
  onQueryChange: (value: string) => void
}

export function RuleSidebar({
  rules,
  selectedRuleId,
  query,
  isCreating,
  onCreate,
  onSelect,
  onRun,
  onDelete,
  onToggle,
  onQueryChange
}: RuleSidebarProps) {
  const { t } = useTranslation()
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem('automationRuleFavorites')
      if (!raw) return []
      const parsed = JSON.parse(raw) as string[]
      if (!Array.isArray(parsed)) return []
      return parsed
    } catch {
      return []
    }
  })

  useEffect(() => {
    window.localStorage.setItem('automationRuleFavorites', JSON.stringify(favorites))
  }, [favorites])

  const favoriteSet = useMemo(() => new Set(favorites), [favorites])
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

  const toggleFavorite = useCallback((ruleId: string) => {
    setFavorites(prev => prev.includes(ruleId) ? prev.filter(id => id !== ruleId) : [...prev, ruleId])
  }, [])

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
      <div className='automation-view__sidebar-header'>
        <div className='automation-view__title'>
          <span className='material-symbols-rounded automation-view__title-icon'>schedule</span>
          <h2 className='automation-view__title-text'>{t('automation.title')}</h2>
        </div>
        <Tooltip title={isCreating ? t('automation.creatingRule') : t('automation.newRule')}>
          <Button
            className='automation-view__icon-button automation-view__icon-button--add'
            type='text'
            onClick={onCreate}
            disabled={isCreating}
          >
            <span className='material-symbols-rounded automation-view__action-icon'>
              {isCreating ? 'progress_activity' : 'add'}
            </span>
          </Button>
        </Tooltip>
      </div>
      <div className='automation-view__sidebar-search'>
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t('automation.searchRule')}
          prefix={<span className='material-symbols-rounded automation-view__search-icon'>search</span>}
          allowClear
        />
      </div>

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
              return (
                <List.Item
                  className={`automation-view__rule-item ${active ? 'automation-view__rule-item--active' : ''}`}
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
                        <Tag color={primaryType === 'interval' ? 'blue' : primaryType === 'cron' ? 'geekblue' : 'purple'}>
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
                        <span className='automation-view__rule-last'>
                          <span className='material-symbols-rounded automation-view__meta-icon'>update</span>
                          {rule.lastRunAt
                            ? t('automation.lastRunAt', { time: dayjs(rule.lastRunAt).format('YYYY-MM-DD HH:mm') })
                            : t('automation.noRunYet')}
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
                        <Tooltip title={t('automation.run')}>
                          <Button
                            className='automation-view__icon-button automation-view__icon-button--run'
                            type='text'
                            onClick={(event) => {
                              event.stopPropagation()
                              void onRun(rule)
                            }}
                          >
                            <span className='material-symbols-rounded automation-view__action-icon'>play_arrow</span>
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
                        <Tooltip title={isFavorite ? t('automation.unfavorite') : t('automation.favorite')}>
                          <Button
                            className={`automation-view__icon-button automation-view__icon-button--favorite ${isFavorite ? 'automation-view__icon-button--active' : ''}`}
                            type='text'
                            onClick={(event) => {
                              event.stopPropagation()
                              toggleFavorite(rule.id)
                            }}
                          >
                            <span className={`material-symbols-rounded automation-view__action-icon ${isFavorite ? 'automation-view__action-icon--star' : ''}`}>
                              {isFavorite ? 'star' : 'star_outline'}
                            </span>
                          </Button>
                        </Tooltip>
                      </div>
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
