import './index.scss'

import { App } from 'antd'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { useMobileSidebarModal } from '#~/components/layout/@hooks/use-mobile-sidebar-modal'
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
  const [mobilePanel, setMobilePanel] = useState<'rules' | 'details'>('details')
  const [isRulePanelCollapsed, setIsRulePanelCollapsed] = useState(false)
  const detailPanelRef = useRef<HTMLDivElement | null>(null)
  const mobileRulePanelSheetRef = useRef<HTMLDivElement | null>(null)
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
  const isCompactView = isCompactLayout || isTouchInteraction
  const isMobileRulePanelOpen = isCompactView && mobilePanel === 'rules'
  const mobileRulePanelBackgroundRefs = useMemo(() => [detailPanelRef], [])

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
    return null
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
  const favoriteSet = useMemo(() => new Set(favorites), [favorites])

  useEffect(() => {
    window.localStorage.setItem('automationRuleFavorites', JSON.stringify(favorites))
  }, [favorites])

  useEffect(() => {
    if (!values.rule) return
    if (rules.some(rule => rule.id === values.rule)) return
    update({ rule: '' })
  }, [rules, update, values.rule])

  useEffect(() => {
    if (!isCompactView) return
    if (panelMode !== 'view' || values.rule) {
      setMobilePanel('details')
    }
  }, [isCompactView, panelMode, values.rule])

  useMobileSidebarModal({
    backgroundRefs: mobileRulePanelBackgroundRefs,
    isCompactLayout: isCompactView,
    isMobileSidebarOpen: isMobileRulePanelOpen,
    setIsMobileSidebarOpen: (nextOpen) => setMobilePanel(nextOpen ? 'rules' : 'details'),
    sheetRef: mobileRulePanelSheetRef
  })

  const handleSelectRule = useCallback((ruleId: string) => {
    setPanelMode('view')
    if (panelMode === 'view' && selectedRuleId === ruleId) {
      update({ rule: '' })
      if (isCompactView) {
        setMobilePanel('details')
      }
      return
    }
    update({ rule: ruleId })
    if (isCompactView) {
      setMobilePanel('details')
    }
  }, [isCompactView, panelMode, selectedRuleId, update])

  const handleCreateRule = useCallback(() => {
    setPanelMode('create')
    if (isCompactView) {
      setMobilePanel('details')
    }
  }, [isCompactView])

  const handleCollapseRulePanel = useCallback(() => {
    if (isCompactView) {
      setMobilePanel('details')
      return
    }

    setIsRulePanelCollapsed(true)
  }, [isCompactView])

  const handleExpandRulePanel = useCallback(() => {
    if (isCompactView) {
      setMobilePanel('rules')
      return
    }

    setIsRulePanelCollapsed(false)
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
      setMobilePanel('details')
    }
  }, [isCompactView])

  const detailsShouldShowRulePanelAction = isCompactView || (!isCompactView && isRulePanelCollapsed)

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

  const handleToggleFavorite = useCallback((ruleId: string) => {
    setFavorites(prev => prev.includes(ruleId) ? prev.filter(id => id !== ruleId) : [...prev, ruleId])
  }, [])

  const ruleSidebar = (
    <RuleSidebar
      rules={rules}
      selectedRuleId={selectedRuleId}
      query={values.q}
      isCreating={panelMode === 'create'}
      favoriteIds={favorites}
      collapsible
      onCreate={handleCreateRule}
      onSelect={handleSelectRule}
      onRun={handleRun}
      onDelete={handleDelete}
      onToggleFavorite={handleToggleFavorite}
      onToggle={handleToggle}
      onToggleCollapsed={handleCollapseRulePanel}
      onQueryChange={(value: string) => update({ q: value })}
    />
  )

  return (
    <PageShell
      className={[
        'automation-view',
        isCompactView ? 'automation-view--compact' : '',
        !isCompactView && isRulePanelCollapsed ? 'automation-view--left-collapsed' : ''
      ].filter(Boolean).join(' ')}
      bodyClassName='automation-view__body'
    >
      {isCompactView
        ? (
          <>
            <button
              type='button'
              className={`automation-view__mobile-rule-backdrop ${isMobileRulePanelOpen ? 'is-open' : ''}`}
              aria-label={t('common.close')}
              aria-hidden={!isMobileRulePanelOpen}
              tabIndex={-1}
              onClick={() => setMobilePanel('details')}
            />
            <div
              ref={mobileRulePanelSheetRef}
              className={`automation-view__mobile-rule-sheet ${isMobileRulePanelOpen ? 'is-open' : ''}`}
              role='dialog'
              aria-modal={isMobileRulePanelOpen ? 'true' : undefined}
              aria-label={t('automation.mobileRules')}
              aria-hidden={!isMobileRulePanelOpen}
              tabIndex={-1}
            >
              <div className='automation-view__left automation-view__left--mobile-sheet'>
                {ruleSidebar}
              </div>
            </div>
          </>
        )
        : (
          <div className={`automation-view__left ${!isCompactView && isRulePanelCollapsed ? 'is-collapsed' : ''}`}>
            {ruleSidebar}
          </div>
        )}
      <div ref={detailPanelRef} className='automation-view__right'>
        {panelMode === 'create' && (
          <RuleFormPanel
            isRulePanelCollapsed={detailsShouldShowRulePanelAction}
            mode='create'
            rule={null}
            submitting={submitting}
            onCreateRule={handleCreateRule}
            onExpandRulePanel={handleExpandRulePanel}
            onSubmit={handleSubmit}
            onCancel={handleCancelForm}
          />
        )}
        {panelMode === 'edit' && (
          <RuleFormPanel
            isRulePanelCollapsed={detailsShouldShowRulePanelAction}
            mode='edit'
            rule={selectedRule}
            submitting={submitting}
            onCreateRule={handleCreateRule}
            onExpandRulePanel={handleExpandRulePanel}
            onSubmit={handleSubmit}
            onCancel={handleCancelForm}
          />
        )}
        {panelMode === 'view' && (
          <RunHistoryPanel
            compact={isCompactView}
            isRulePanelCollapsed={detailsShouldShowRulePanelAction}
            rule={selectedRule}
            runs={runs}
            runQuery={values.runQ}
            statusFilter={values.status}
            timeFilter={values.time}
            sortOrder={values.sort}
            onCreateRule={handleCreateRule}
            onExpandRulePanel={handleExpandRulePanel}
            onEditRule={handleEditRule}
            onRunRule={handleRun}
            onDeleteRule={handleDelete}
            isFavorite={selectedRule != null && favoriteSet.has(selectedRule.id)}
            onToggleFavorite={handleToggleFavorite}
            onRunQueryChange={(value: string) => update({ runQ: value })}
            onStatusFilterChange={(value: string) => update({ status: value })}
            onTimeFilterChange={(value: string) => update({ time: value })}
            onSortOrderChange={(value: string) => update({ sort: value })}
          />
        )}
      </div>
    </PageShell>
  )
}
