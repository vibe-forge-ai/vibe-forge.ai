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
    },
  ], [t])

  if (!rule) {
    return (
      <div className='automation-view__empty'>
        <Empty description={t('automation.selectRule')} />
      </div>
    )
  }

  return (
    <div className='automation-view__content'>
      <div className='automation-view__detail-card'>
        <div className='automation-view__detail-header'>
          <div className='automation-view__detail-title'>
            <span className='material-symbols-rounded automation-view__content-icon'>info</span>
            <h3 className='automation-view__content-text'>{rule.name}</h3>
          </div>
          <Button
            className='automation-view__icon-button automation-view__icon-button--edit'
            type='text'
            onClick={() => onEditRule(rule)}
          >
            <span className='material-symbols-rounded automation-view__action-icon'>edit</span>
          </Button>
        </div>
        <div className='automation-view__detail-meta'>
          <span className='automation-view__detail-item'>
            <span className='material-symbols-rounded automation-view__meta-icon'>description</span>
            {rule.description || t('automation.noDescription')}
          </span>
          <span className='automation-view__detail-item'>
            <span className='material-symbols-rounded automation-view__meta-icon'>bolt</span>
            {t('automation.triggerCount', { count: rule.triggers?.length ?? 0 })}
          </span>
          <span className='automation-view__detail-item'>
            <span className='material-symbols-rounded automation-view__meta-icon'>checklist</span>
            {t('automation.taskCount', { count: rule.tasks?.length ?? 0 })}
          </span>
          <span className='automation-view__detail-item'>
            <span className='material-symbols-rounded automation-view__meta-icon'>update</span>
            {rule.lastRunAt
              ? t('automation.lastRunAt', { time: dayjs(rule.lastRunAt).format('YYYY-MM-DD HH:mm') })
              : t('automation.noRunYet')}
          </span>
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
