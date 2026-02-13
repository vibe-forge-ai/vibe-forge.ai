import './RunHistoryPanel.scss'

import { Button, Empty, Input, Select, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { AutomationRule, AutomationRun } from '#~/api.js'

interface RunHistoryPanelProps {
  rule: AutomationRule | null
  runs: AutomationRun[]
  runQuery: string
  statusFilter: string
  timeFilter: string
  sortOrder: string
  onEditRule: (rule: AutomationRule) => void
  onRunQueryChange: (value: string) => void
  onStatusFilterChange: (value: string) => void
  onTimeFilterChange: (value: string) => void
  onSortOrderChange: (value: string) => void
}

export function RunHistoryPanel({
  rule,
  runs,
  runQuery,
  statusFilter,
  timeFilter,
  sortOrder,
  onEditRule,
  onRunQueryChange,
  onStatusFilterChange,
  onTimeFilterChange,
  onSortOrderChange
}: RunHistoryPanelProps) {
  const { t } = useTranslation()

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

  const recentRuns = useMemo(() => {
    if (runs.length === 0) return []
    const sorted = [...runs].sort((a, b) => b.runAt - a.runAt)
    const latestSessionId = sorted[0]?.sessionId
    if (!latestSessionId) return sorted.slice(0, 1)
    return sorted.filter((run) => run.sessionId === latestSessionId)
  }, [runs])

  if (!rule) {
    return (
      <div className='automation-view__empty'>
        <Empty description={t('automation.selectRule')} />
      </div>
    )
  }

  const triggerLabels = (rule.triggers ?? []).map((trigger) => {
    if (trigger.type === 'interval') {
      const minutes = trigger.intervalMs ? Math.max(1, Math.round(trigger.intervalMs / 60000)) : 1
      return t('automation.intervalEvery', { minutes })
    }
    if (trigger.type === 'cron') {
      const expression = trigger.cronExpression?.trim() || '-'
      return t('automation.cronExpression', { expression })
    }
    return t('automation.webhookTrigger')
  })
  const taskLabels = (rule.tasks ?? []).map((task, index) => (
    task.title || t('automation.taskDefaultTitle', { index: index + 1 })
  ))

  return (
    <div className='automation-view__content'>
      <div className='automation-view__detail'>
        <div className='automation-view__detail-header'>
          <div className='automation-view__detail-title'>
            <h3 className='automation-view__content-text'>{rule.name}</h3>
            <span className='automation-view__detail-id'>{rule.id}</span>
          </div>
          <Button
            className='automation-view__icon-button automation-view__icon-button--edit'
            type='text'
            onClick={() => onEditRule(rule)}
          >
            <span className='material-symbols-rounded automation-view__action-icon'>edit</span>
          </Button>
        </div>
        <div className='automation-view__detail-description'>
          <span className='material-symbols-rounded automation-view__meta-icon'>description</span>
          <span>{rule.description || t('automation.noDescription')}</span>
        </div>
        <div className='automation-view__detail-body'>
          <div className='automation-view__detail-left'>
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
            <div className='automation-view__detail-list'>
              <div className='automation-view__detail-row'>
                <span className='material-symbols-rounded automation-view__meta-icon'>update</span>
                <span className='automation-view__detail-label'>{t('automation.lastRunLabel')}</span>
              </div>
              <div className='automation-view__run-list'>
                {recentRuns.length > 0
                  ? recentRuns.map((run) => (
                    <div key={run.id} className='automation-view__run-item'>
                      <a
                        className='automation-view__run-link'
                        href={`/session/${run.sessionId}?tag=${
                          encodeURIComponent(`automation:${rule.id}:${rule.name}`)
                        }`}
                        target='_blank'
                        rel='noreferrer'
                      >
                        {run.taskTitle ?? t('automation.taskUnknown')}
                      </a>
                      <span className='automation-view__run-time'>
                        {dayjs(run.runAt).format('YYYY-MM-DD HH:mm')}
                      </span>
                    </div>
                  ))
                  : <span className='automation-view__detail-value'>{t('automation.noRunYet')}</span>}
              </div>
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
          <div className='automation-view__detail-right'>
            <div className='automation-view__detail-section'>
              <div className='automation-view__detail-section-title'>
                <span className='material-symbols-rounded automation-view__meta-icon'>bolt</span>
                {t('automation.sectionTriggers')}
              </div>
              <div className='automation-view__detail-chips'>
                {triggerLabels.length
                  ? triggerLabels.map((label, index) => (
                    <span key={`${label}-${index}`} className='automation-view__detail-chip'>
                      {label}
                    </span>
                  ))
                  : <span className='automation-view__detail-placeholder'>{t('automation.noTriggers')}</span>}
              </div>
            </div>
            <div className='automation-view__detail-section'>
              <div className='automation-view__detail-section-title'>
                <span className='material-symbols-rounded automation-view__meta-icon'>task</span>
                {t('automation.sectionTasks')}
              </div>
              <div className='automation-view__detail-chips'>
                {taskLabels.length
                  ? taskLabels.map((label, index) => (
                    <span key={`${label}-${index}`} className='automation-view__detail-chip'>
                      {label}
                    </span>
                  ))
                  : <span className='automation-view__detail-placeholder'>{t('automation.noTasks')}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className='automation-view__content-header'>
        <div className='automation-view__content-title'>
          <span className='material-symbols-rounded automation-view__content-icon'>history</span>
          <h3 className='automation-view__content-text'>{t('automation.runHistory')}</h3>
        </div>
      </div>
      <div className='automation-view__run-filters'>
        <Input
          value={runQuery}
          onChange={(event) => onRunQueryChange(event.target.value)}
          placeholder={t('automation.runSearch')}
          className='automation-view__run-search'
          allowClear
        />
        <Select
          value={statusFilter}
          onChange={onStatusFilterChange}
          className='automation-view__run-select'
          options={[
            { label: t('automation.statusAll'), value: 'all' },
            { label: t('common.status.running'), value: 'running' },
            { label: t('common.status.completed'), value: 'completed' },
            { label: t('common.status.failed'), value: 'failed' },
            { label: t('common.status.terminated'), value: 'terminated' },
            { label: t('common.status.waiting_input'), value: 'waiting_input' }
          ]}
        />
        <Select
          value={timeFilter}
          onChange={onTimeFilterChange}
          className='automation-view__run-select'
          options={[
            { label: t('automation.timeAll'), value: 'all' },
            { label: t('automation.time24h'), value: '24h' },
            { label: t('automation.time7d'), value: '7d' },
            { label: t('automation.time30d'), value: '30d' }
          ]}
        />
        <Select
          value={sortOrder}
          onChange={onSortOrderChange}
          className='automation-view__run-select'
          options={[
            { label: t('automation.sortDesc'), value: 'desc' },
            { label: t('automation.sortAsc'), value: 'asc' }
          ]}
        />
      </div>
      {filteredRuns.length === 0
        ? (
          <div className='automation-view__empty'>
            <Empty description={t('automation.noRuns')} />
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
  )
}
