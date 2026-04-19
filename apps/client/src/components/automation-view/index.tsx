import './index.scss'

import { App, Segmented } from 'antd'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import useSWR from 'swr'

import type { AutomationRule, AutomationRun } from '#~/api.js'
import {
  createAutomationRule,
  deleteAutomationRule,
  getApiErrorMessage,
  listAutomationRules,
  listAutomationRuns,
  runAutomationRule,
  updateAutomationRule
} from '#~/api.js'
import { PageShell } from '#~/components/layout/PageShell'
import { useResponsiveLayout } from '#~/hooks/use-responsive-layout'
import { useQueryParams } from '#~/hooks/useQueryParams.js'

import { RuleFormPanel } from './RuleFormPanel.js'
import { RuleSidebar } from './RuleSidebar.js'
import { RunHistoryPanel } from './RunHistoryPanel.js'

type PanelMode = 'view' | 'create' | 'edit'

interface AutomationQueryParams extends Record<string, string> {
  rule: string
  q: string
  runQ: string
  status: string
  time: string
  sort: string
}

export function AutomationView() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { isCompactLayout, isTouchInteraction } = useResponsiveLayout()
  const navigate = useNavigate()
  const { data, mutate } = useSWR<{ rules: AutomationRule[] }>(
    '/api/automation/rules',
    listAutomationRules
  )
  const rules = data?.rules ?? []
  const [panelMode, setPanelMode] = useState<PanelMode>('view')
  const [submitting, setSubmitting] = useState(false)
  const [mobilePanel, setMobilePanel] = useState<'rules' | 'details'>('rules')
  const [isRulePanelCollapsed, setIsRulePanelCollapsed] = useState(false)
  const isCompactView = isCompactLayout || isTouchInteraction

  const { values, update } = useQueryParams<AutomationQueryParams>({
    keys: ['rule', 'q', 'runQ', 'status', 'time', 'sort'],
    defaults: {
      rule: '',
      q: '',
      runQ: '',
      status: 'all',
      time: 'all',
      sort: 'desc'
    },
    omit: {
      rule: (value: string) => value === '',
      q: (value: string) => value === '',
      runQ: (value: string) => value === '',
      status: (value: string) => value === 'all',
      time: (value: string) => value === 'all',
      sort: (value: string) => value === 'desc'
    }
  })

  const selectedRuleId = useMemo(() => {
    const fromUrl = values.rule
    if (fromUrl && rules.some(rule => rule.id === fromUrl)) return fromUrl
    return rules[0]?.id ?? null
  }, [rules, values.rule])

  const selectedRule = useMemo(
    () => rules.find(rule => rule.id === selectedRuleId) ?? null,
    [rules, selectedRuleId]
  )

  const { data: runsData, mutate: mutateRuns } = useSWR<{ runs: AutomationRun[] }>(
    selectedRuleId ? `/api/automation/rules/${selectedRuleId}/runs` : null,
    () => listAutomationRuns(selectedRuleId ?? '')
  )
  const runs = runsData?.runs ?? []

  useEffect(() => {
    if (rules.length === 0) return
    if (!values.rule || !rules.some(rule => rule.id === values.rule)) {
      update({ rule: rules[0].id })
    }
  }, [rules, update, values.rule])

  useEffect(() => {
    if (!isCompactView) return
    if (panelMode !== 'view') {
      setMobilePanel('details')
      return
    }
    if (selectedRuleId == null) {
      setMobilePanel(rules.length === 0 ? 'details' : 'rules')
    }
  }, [isCompactView, panelMode, rules.length, selectedRuleId])

  const handleSelectRule = useCallback((ruleId: string) => {
    setPanelMode('view')
    update({ rule: ruleId })
    if (isCompactView) {
      setMobilePanel('details')
    }
  }, [isCompactView, update])

  const handleCreateRule = useCallback(() => {
    setPanelMode('create')
    if (isCompactView) {
      setMobilePanel('details')
    }
  }, [isCompactView])

  const handleEditRule = useCallback((rule: AutomationRule) => {
    setPanelMode('edit')
    update({ rule: rule.id })
    if (isCompactView) {
      setMobilePanel('details')
    }
  }, [isCompactView, update])

  const handleCancelForm = useCallback(() => {
    setPanelMode('view')
    if (isCompactView) {
      setMobilePanel(selectedRuleId != null ? 'details' : 'rules')
    }
  }, [isCompactView, selectedRuleId])

  const showRuleList = isCompactView ? mobilePanel === 'rules' : true
  const showDetails = !isCompactView || mobilePanel === 'details'
  const detailDisabled = panelMode === 'view' && selectedRule == null && rules.length > 0

  const handleSubmit = useCallback(async (
    payload: Partial<AutomationRule>,
    immediateRun: boolean
  ) => {
    try {
      setSubmitting(true)
      if (panelMode === 'create') {
        const res = await createAutomationRule({ ...payload, immediateRun })
        await mutate()
        if (res.rule?.id) {
          update({ rule: res.rule.id })
        }
        setPanelMode('view')
        return
      }
      if (panelMode === 'edit' && selectedRule) {
        await updateAutomationRule(selectedRule.id, { ...payload, immediateRun })
        await mutate()
        void mutateRuns()
        setPanelMode('view')
      }
    } catch (error) {
      void message.error(getApiErrorMessage(error, t('automation.saveFailed')))
    } finally {
      setSubmitting(false)
    }
  }, [panelMode, mutate, mutateRuns, message, selectedRule, t])

  const handleDelete = useCallback(async (rule: AutomationRule) => {
    try {
      await deleteAutomationRule(rule.id)
      if (selectedRuleId === rule.id) {
        update({ rule: '' })
        setPanelMode('view')
      }
      void mutate()
      void message.success(t('automation.deleted'))
    } catch (error) {
      void message.error(getApiErrorMessage(error, t('automation.deleteFailed')))
    }
  }, [message, mutate, selectedRuleId, t])

  const handleRun = useCallback(async (rule: AutomationRule) => {
    try {
      const res = await runAutomationRule(rule.id)
      const nextSessionId = res.sessionIds?.[0]
      if (nextSessionId) {
        void message.success(t('automation.runStarted'))
        void mutateRuns()
        void navigate(`/session/${nextSessionId}`)
      }
    } catch (error) {
      void message.error(getApiErrorMessage(error, t('automation.runFailed')))
    }
  }, [message, mutateRuns, navigate, t])

  const handleToggle = useCallback(async (rule: AutomationRule, enabled: boolean) => {
    try {
      await updateAutomationRule(rule.id, { enabled })
      void mutate()
    } catch (error) {
      void message.error(getApiErrorMessage(error, t('automation.toggleFailed')))
    }
  }, [message, mutate, t])

  return (
    <PageShell
      className={[
        'automation-view',
        isCompactView ? 'automation-view--compact' : '',
        !isCompactView && isRulePanelCollapsed ? 'automation-view--left-collapsed' : ''
      ].filter(Boolean).join(' ')}
      bodyClassName='automation-view__body'
    >
      {isCompactView && (
        <div className='automation-view__mobile-switcher-shell'>
          <Segmented
            block
            className='automation-view__mobile-switcher'
            value={mobilePanel}
            onChange={(value) => setMobilePanel(value as 'rules' | 'details')}
            options={[
              { label: t('automation.mobileRules'), value: 'rules' },
              { label: t('automation.mobileDetails'), value: 'details', disabled: detailDisabled }
            ]}
          />
        </div>
      )}
      {showRuleList && (
        <div className={`automation-view__left ${!isCompactView && isRulePanelCollapsed ? 'is-collapsed' : ''}`}>
          <RuleSidebar
            rules={rules}
            selectedRuleId={selectedRuleId}
            query={values.q}
            isCreating={panelMode === 'create'}
            collapsible={!isCompactView}
            onCreate={handleCreateRule}
            onSelect={handleSelectRule}
            onRun={handleRun}
            onDelete={handleDelete}
            onToggle={handleToggle}
            onToggleCollapsed={() => setIsRulePanelCollapsed(true)}
            onQueryChange={(value: string) => update({ q: value })}
          />
        </div>
      )}
      {showDetails && (
        <div className='automation-view__right'>
          {panelMode === 'create' && (
            <RuleFormPanel
              isRulePanelCollapsed={!isCompactView && isRulePanelCollapsed}
              mode='create'
              rule={null}
              submitting={submitting}
              onCreateRule={handleCreateRule}
              onExpandRulePanel={() => setIsRulePanelCollapsed(false)}
              onSubmit={handleSubmit}
              onCancel={handleCancelForm}
            />
          )}
          {panelMode === 'edit' && (
            <RuleFormPanel
              isRulePanelCollapsed={!isCompactView && isRulePanelCollapsed}
              mode='edit'
              rule={selectedRule}
              submitting={submitting}
              onCreateRule={handleCreateRule}
              onExpandRulePanel={() => setIsRulePanelCollapsed(false)}
              onSubmit={handleSubmit}
              onCancel={handleCancelForm}
            />
          )}
          {panelMode === 'view' && (
            <RunHistoryPanel
              compact={isCompactView}
              isRulePanelCollapsed={!isCompactView && isRulePanelCollapsed}
              rule={selectedRule}
              runs={runs}
              runQuery={values.runQ}
              statusFilter={values.status}
              timeFilter={values.time}
              sortOrder={values.sort}
              onCreateRule={handleCreateRule}
              onExpandRulePanel={() => setIsRulePanelCollapsed(false)}
              onEditRule={handleEditRule}
              onRunQueryChange={(value: string) => update({ runQ: value })}
              onStatusFilterChange={(value: string) => update({ status: value })}
              onTimeFilterChange={(value: string) => update({ time: value })}
              onSortOrderChange={(value: string) => update({ sort: value })}
            />
          )}
        </div>
      )}
    </PageShell>
  )
}
