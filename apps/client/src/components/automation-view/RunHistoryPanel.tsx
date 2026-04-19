import './RunHistoryPanel.scss'

import { Button, Empty, Input, Select, Table, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { AutomationRule, AutomationRun } from '#~/api.js'

import { AutomationEmptyLanding } from './AutomationEmptyLanding'
import { AutomationRuleDetailPreview } from './AutomationRuleDetailPreview'
import { AutomationPanelTitleActions } from './PanelTitleActions'

interface RunHistoryPanelProps {
  compact?: boolean
  isRulePanelCollapsed?: boolean
  rule: AutomationRule | null
  runs: AutomationRun[]
  runQuery: string
  statusFilter: string
  timeFilter: string
  sortOrder: string
  onCreateRule?: () => void
  onExpandRulePanel?: () => void
  onEditRule: (rule: AutomationRule) => void
  onRunRule: (rule: AutomationRule) => void
  onDeleteRule: (rule: AutomationRule) => void
  isFavorite: boolean
  onToggleFavorite: (ruleId: string) => void
  onRunQueryChange: (value: string) => void
  onStatusFilterChange: (value: string) => void
  onTimeFilterChange: (value: string) => void
  onSortOrderChange: (value: string) => void
}

export function RunHistoryPanel({
  compact = false,
  isRulePanelCollapsed = false,
  rule,
  runs,
  runQuery,
  statusFilter,
  timeFilter,
  sortOrder,
  onCreateRule,
  onExpandRulePanel,
  onEditRule,
  onRunRule,
  onDeleteRule,
  isFavorite,
  onToggleFavorite,
  onRunQueryChange,
  onStatusFilterChange,
  onTimeFilterChange,
  onSortOrderChange
}: RunHistoryPanelProps) {
  const { t } = useTranslation()
  const [runFiltersOpen, setRunFiltersOpen] = useState(false)

  const filteredRuns = useMemo(() => {
    const keyword = runQuery.trim().toLowerCase()
    const now = Date.now()
    const timeLimitMap: Record<string, number | null> = {
      all: null,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    }
    const timeLimit = timeLimitMap[timeFilter] ?? null
    const base = runs.filter((run) => {
      if (statusFilter !== 'all' && (run.status ?? 'unknown') !== statusFilter) return false
      if (timeLimit != null && now - run.runAt > timeLimit) return false
      if (!keyword) return true
      const text = [
        run.taskTitle,
        run.title,
        run.lastMessage,
        run.lastUserMessage,
        run.sessionId
      ].filter(Boolean).join(' ').toLowerCase()
      return text.includes(keyword)
    })
    return base.sort((a, b) => {
      if (sortOrder === 'asc') return a.runAt - b.runAt
      return b.runAt - a.runAt
    })
  }, [runQuery, runs, sortOrder, statusFilter, timeFilter])

  const columns: ColumnsType<AutomationRun> = useMemo(() => [
    {
      title: t('automation.runTime'),
      dataIndex: 'runAt',
      key: 'runAt',
      render: (value: number) => dayjs(value).format('YYYY-MM-DD HH:mm')
    },
    {
      title: t('automation.taskTitle'),
      dataIndex: 'taskTitle',
      key: 'taskTitle',
      render: (_value: string | null | undefined, run) => (
        <div className='automation-view__task-cell'>
          <a className='automation-view__task-link' href={`/session/${run.sessionId}`}>
            <span className='material-symbols-rounded automation-view__task-icon'>task_alt</span>
            <span className='automation-view__task-text'>{run.taskTitle ?? t('automation.taskUnknown')}</span>
            {run.status
              ? (
                <span className='automation-view__status' data-status={run.status}>
                  <span className='material-symbols-rounded automation-view__status-icon'>fiber_manual_record</span>
                  {t(`common.status.${run.status}`, run.status)}
                </span>
              )
              : (
                <span className='automation-view__status'>-</span>
              )}
          </a>
        </div>
      )
    },
    {
      title: t('automation.runSummary'),
      dataIndex: 'lastMessage',
      key: 'summary',
      render: (_value: string | undefined, run) => {
        const text = run.title ?? run.lastMessage ?? run.lastUserMessage ?? '-'
        return <span className='automation-view__run-summary'>{text}</span>
      }
    }
  ], [t])

  if (!rule) {
    return (
      <AutomationEmptyLanding
        flushPanelPadding
        isRulePanelCollapsed={isRulePanelCollapsed}
        onCreateRule={onCreateRule}
        onExpandRulePanel={onExpandRulePanel}
      />
    )
  }

  const statusOptions = [
    { label: t('automation.statusAll'), value: 'all' },
    { label: t('common.status.running'), value: 'running' },
    { label: t('common.status.completed'), value: 'completed' },
    { label: t('common.status.failed'), value: 'failed' },
    { label: t('common.status.terminated'), value: 'terminated' },
    { label: t('common.status.waiting_input'), value: 'waiting_input' }
  ]
  const timeOptions = [
    { label: t('automation.timeAll'), value: 'all' },
    { label: t('automation.time24h'), value: '24h' },
    { label: t('automation.time7d'), value: '7d' },
    { label: t('automation.time30d'), value: '30d' }
  ]
  const sortOptions = [
    { label: t('automation.sortDesc'), value: 'desc' },
    { label: t('automation.sortAsc'), value: 'asc' }
  ]
  const primaryType = rule.triggers?.[0]?.type ?? rule.type
  const titleIcon = primaryType === 'interval' ? 'timer' : primaryType === 'cron' ? 'schedule' : 'webhook'

  return (
    <div className='automation-view__content'>
      <div className='automation-view__surface automation-view__detail-surface'>
        <div className='automation-view__detail'>
          <div className='automation-view__detail-header'>
            <div className='automation-view__detail-title-shell'>
              <AutomationPanelTitleActions
                collapsed={isRulePanelCollapsed}
                isCreating={false}
                onCreateRule={onCreateRule}
                onExpandRulePanel={onExpandRulePanel}
              />
              <div className='automation-view__detail-title'>
                <span
                  className={`material-symbols-rounded automation-view__detail-title-icon automation-view__detail-title-icon--${primaryType}`}
                >
                  {titleIcon}
                </span>
                <h3 className='automation-view__content-text'>{rule.name}</h3>
              </div>
            </div>
            <div className='automation-view__detail-actions'>
              <Tooltip title={t('automation.run')}>
                <Button
                  className='automation-view__icon-button automation-view__icon-button--detail-run'
                  type='text'
                  onClick={() => onRunRule(rule)}
                >
                  <span className='material-symbols-rounded automation-view__action-icon'>play_arrow</span>
                </Button>
              </Tooltip>
              <Tooltip title={isFavorite ? t('automation.unfavorite') : t('automation.favorite')}>
                <Button
                  className={`automation-view__icon-button automation-view__icon-button--detail-favorite ${
                    isFavorite ? 'automation-view__icon-button--active' : ''
                  }`}
                  type='text'
                  onClick={() => onToggleFavorite(rule.id)}
                >
                  <span
                    className={`material-symbols-rounded automation-view__action-icon ${isFavorite ? 'filled' : ''}`}
                  >
                    {isFavorite ? 'star' : 'star_outline'}
                  </span>
                </Button>
              </Tooltip>
              <Tooltip title={t('automation.delete')}>
                <Button
                  className='automation-view__icon-button automation-view__icon-button--detail-delete'
                  type='text'
                  onClick={() => onDeleteRule(rule)}
                >
                  <span className='material-symbols-rounded automation-view__action-icon'>delete</span>
                </Button>
              </Tooltip>
              <Tooltip title={t('automation.edit')}>
                <Button
                  className='automation-view__icon-button automation-view__icon-button--edit'
                  type='text'
                  onClick={() => onEditRule(rule)}
                >
                  <span className='material-symbols-rounded automation-view__action-icon'>edit</span>
                </Button>
              </Tooltip>
            </div>
          </div>
          <div className='automation-view__detail-description'>
            <span className='material-symbols-rounded automation-view__meta-icon'>description</span>
            <span>{rule.description || t('automation.noDescription')}</span>
          </div>
          <div className='automation-view__detail-body'>
            <div className='automation-view__detail-section automation-view__detail-section--meta'>
              <div className='automation-view__detail-row'>
                <span className='material-symbols-rounded automation-view__meta-icon'>event</span>
                <span className='automation-view__detail-label'>{t('automation.createdAt')}</span>
                <span className='automation-view__detail-value'>
                  {dayjs(rule.createdAt).format('YYYY-MM-DD HH:mm')}
                </span>
              </div>
              <div className='automation-view__detail-row'>
                <span className='material-symbols-rounded automation-view__meta-icon'>toggle_on</span>
                <span className='automation-view__detail-label'>{t('automation.ruleStatus')}</span>
                <span className='automation-view__detail-value' data-status={rule.enabled ? 'enabled' : 'disabled'}>
                  {rule.enabled ? t('automation.enabledOn') : t('automation.enabledOff')}
                </span>
              </div>
              {rule.lastSessionId && (
                <div className='automation-view__detail-row'>
                  <span className='material-symbols-rounded automation-view__meta-icon'>open_in_new</span>
                  <a
                    className='automation-view__detail-label automation-view__detail-link'
                    href={`/session/${rule.lastSessionId}?tag=${
                      encodeURIComponent(`automation:${rule.id}:${rule.name}`)
                    }`}
                    target='_blank'
                    rel='noreferrer'
                  >
                    {t('automation.relatedSession')}
                  </a>
                </div>
              )}
            </div>
            <AutomationRuleDetailPreview rule={rule} />
          </div>
        </div>
      </div>

      <div className='automation-view__surface automation-view__history-surface'>
        <div className='automation-view__content-header'>
          <div className='automation-view__content-title'>
            <span className='material-symbols-rounded automation-view__content-icon'>history</span>
            <h3 className='automation-view__content-text'>{t('automation.runHistory')}</h3>
          </div>
        </div>
        <div className='automation-view__run-filters'>
          <div className='automation-view__run-filter-main'>
            <Input
              value={runQuery}
              onChange={(event) => onRunQueryChange(event.target.value)}
              placeholder={t('automation.runSearch')}
              className='automation-view__run-search'
              allowClear
              suffix={
                <Button
                  className={`automation-view__run-search-toggle ${runFiltersOpen ? 'is-open' : ''}`.trim()}
                  type='text'
                  aria-label={t('automation.runFilters')}
                  icon={<span className='material-symbols-rounded automation-view__run-filter-icon'>expand_more</span>}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setRunFiltersOpen((open) => !open)}
                />
              }
            />
            {runFiltersOpen && (
              <div className='automation-view__run-filter-panel'>
                <Select
                  value={statusFilter}
                  onChange={onStatusFilterChange}
                  className='automation-view__run-select'
                  options={statusOptions}
                />
              </div>
            )}
          </div>
          <Tooltip title={t('automation.timeRange')}>
            <Select
              aria-label={t('automation.timeRange')}
              className={`automation-view__run-icon-select ${timeFilter !== 'all' ? 'is-active' : ''}`.trim()}
              value={timeFilter}
              onChange={onTimeFilterChange}
              options={timeOptions}
              popupMatchSelectWidth={false}
              suffixIcon={<span className='material-symbols-rounded automation-view__run-filter-icon'>schedule</span>}
            />
          </Tooltip>
          <Tooltip title={t('automation.sortOrder')}>
            <Select
              aria-label={t('automation.sortOrder')}
              className={`automation-view__run-icon-select ${sortOrder !== 'desc' ? 'is-active' : ''}`.trim()}
              value={sortOrder}
              onChange={onSortOrderChange}
              options={sortOptions}
              popupMatchSelectWidth={false}
              suffixIcon={<span className='material-symbols-rounded automation-view__run-filter-icon'>sort</span>}
            />
          </Tooltip>
        </div>
        {filteredRuns.length === 0
          ? (
            <div className='automation-view__empty'>
              <Empty description={t('automation.noRuns')} />
            </div>
          )
          : compact
          ? (
            <div className='automation-view__run-card-list'>
              {filteredRuns.map((run) => (
                <a
                  key={run.id}
                  className='automation-view__run-card'
                  href={`/session/${run.sessionId}`}
                >
                  <div className='automation-view__run-card-header'>
                    <span className='automation-view__run-card-title'>
                      {run.taskTitle ?? t('automation.taskUnknown')}
                    </span>
                    {run.status
                      ? (
                        <span className='automation-view__status' data-status={run.status}>
                          <span className='material-symbols-rounded automation-view__status-icon'>
                            fiber_manual_record
                          </span>
                          {t(`common.status.${run.status}`, run.status)}
                        </span>
                      )
                      : null}
                  </div>
                  <div className='automation-view__run-card-time'>
                    {dayjs(run.runAt).format('YYYY-MM-DD HH:mm')}
                  </div>
                  <div className='automation-view__run-card-summary'>
                    {run.title ?? run.lastMessage ?? run.lastUserMessage ?? '-'}
                  </div>
                </a>
              ))}
            </div>
          )
          : (
            <Table
              rowKey='id'
              className='automation-view__run-table'
              columns={columns}
              dataSource={filteredRuns}
              pagination={{ pageSize: 8, hideOnSinglePage: true }}
            />
          )}
      </div>
    </div>
  )
}
