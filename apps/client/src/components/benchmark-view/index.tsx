import './BenchmarkView.scss'

import { App } from 'antd'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import {
  getApiErrorMessage,
  getBenchmarkResult,
  getBenchmarkRun,
  listBenchmarkCases,
  listBenchmarkCategories,
  startBenchmarkRun
} from '#~/api.js'
import { useQueryParams } from '#~/hooks/useQueryParams.js'
import type { BenchmarkCase } from '@vibe-forge/types'

import { BenchmarkCasePanel } from './BenchmarkCasePanel.js'
import { BenchmarkSidebar } from './BenchmarkSidebar.js'
import type { BenchmarkQueryParams } from './types.js'
import { isTerminalRun } from './utils.js'

export function BenchmarkView() {
  const { t } = useTranslation()
  const { message } = App.useApp()

  // State
  const [activeRunId, setActiveRunId] = useState('')
  const [treeQuery, setTreeQuery] = useState('')
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])
  const [checkedKeys, setCheckedKeys] = useState<string[]>([])

  const { values, update } = useQueryParams<BenchmarkQueryParams>({
    keys: ['category', 'title'],
    defaults: { category: '', title: '' },
    omit: {
      category: (value: string) => value === '',
      title: (value: string) => value === ''
    }
  })

  // Data
  const { data: categoriesData, mutate: mutateCategories } = useSWR(
    '/api/benchmark/categories',
    listBenchmarkCategories
  )
  const categories = categoriesData?.categories ?? []

  const { data: casesData, mutate: mutateCases } = useSWR(
    '/api/benchmark/cases',
    () => listBenchmarkCases()
  )
  const cases = casesData?.cases ?? []

  const selectedCase = useMemo<BenchmarkCase | null>(() => {
    if (cases.length === 0) return null
    const exact = cases.find(item => item.category === values.category && item.title === values.title)
    if (exact) return exact
    const sameCategoryFirst = values.category
      ? cases.find(item => item.category === values.category) ?? null
      : null
    return sameCategoryFirst ?? cases[0] ?? null
  }, [cases, values.category, values.title])

  const { data: resultData, mutate: mutateResult } = useSWR(
    selectedCase ? `/api/benchmark/results/${selectedCase.category}/${selectedCase.title}` : null,
    () => getBenchmarkResult(selectedCase?.category ?? '', selectedCase?.title ?? '')
  )
  const latestResult = resultData?.result ?? selectedCase?.latestResult ?? null

  const { data: runData, mutate: mutateRun } = useSWR(
    activeRunId ? `/api/benchmark/runs/${activeRunId}` : null,
    () => getBenchmarkRun(activeRunId),
    { refreshInterval: activeRunId ? 2000 : 0 }
  )
  const activeRun = runData?.run

  const progressPercent = useMemo(() => {
    const totalCount = activeRun?.totalCount ?? 0
    if (totalCount <= 0) return 0
    const completedCount = activeRun?.completedCount ?? 0
    return Math.min(100, Math.round((completedCount / totalCount) * 100))
  }, [activeRun?.completedCount, activeRun?.totalCount])

  // Handlers
  const handleRunSpecificCase = useCallback(async (item: BenchmarkCase) => {
    try {
      const res = await startBenchmarkRun({ category: item.category, title: item.title })
      setActiveRunId(res.run.runId)
      void message.success(t('benchmark.runStarted'))
    } catch (error) {
      void message.error(getApiErrorMessage(error, t('benchmark.runFailed')))
    }
  }, [message, t])

  const handleRunCategory = useCallback(async (category: string) => {
    try {
      const res = await startBenchmarkRun({ category })
      setActiveRunId(res.run.runId)
      void message.success(t('benchmark.categoryRunStarted'))
    } catch (error) {
      void message.error(getApiErrorMessage(error, t('benchmark.runFailed')))
    }
  }, [message, t])

  const handleBatchRun = useCallback(async () => {
    const caseKeys = checkedKeys.filter(k => k.startsWith('case:'))
    const casesToRun = cases.filter(item => caseKeys.includes(`case:${item.category}/${item.title}`))
    if (casesToRun.length === 0) {
      for (const item of cases) {
        try {
          await startBenchmarkRun({ category: item.category, title: item.title })
        } catch { /* continue */ }
      }
      void message.success(t('benchmark.runStarted'))
      return
    }
    let started = 0
    for (const item of casesToRun) {
      try {
        await startBenchmarkRun({ category: item.category, title: item.title })
        started++
      } catch { /* continue */ }
    }
    if (started > 0) {
      setCheckedKeys([])
      void mutateCases()
      void mutateCategories()
      void message.success(t('benchmark.runStarted'))
    }
  }, [checkedKeys, cases, mutateCases, mutateCategories, message, t])

  // Effects
  useEffect(() => {
    const nextKeys = categories.map(item => `category:${item.category}`)
    setExpandedKeys((prev) => {
      if (prev.length > 0 && treeQuery.trim() === '') return prev
      return nextKeys
    })
  }, [categories, treeQuery])

  useEffect(() => {
    if (selectedCase == null) return
    if (values.category !== selectedCase.category || values.title !== selectedCase.title) {
      update({ category: selectedCase.category, title: selectedCase.title })
    }
  }, [selectedCase, update, values.category, values.title])

  useEffect(() => {
    if (!isTerminalRun(activeRun)) return
    void mutateCases()
    void mutateCategories()
    void mutateResult()
    if (activeRunId !== '') void mutateRun()
    const summary = activeRun?.status === 'completed'
      ? t('benchmark.runCompleted')
      : t('benchmark.runFailed')
    void message.info(summary)
    setActiveRunId('')
  }, [activeRun, activeRunId, message, mutateCases, mutateCategories, mutateResult, mutateRun, t])

  const checkedCaseCount = checkedKeys.filter(k => k.startsWith('case:')).length

  return (
    <div className='benchmark-view'>
      <div className='benchmark-view__left'>
        <BenchmarkSidebar
          cases={cases}
          categories={categories}
          selectedCase={selectedCase}
          query={treeQuery}
          expandedKeys={expandedKeys}
          checkedKeys={checkedKeys}
          checkedCaseCount={checkedCaseCount}
          onQueryChange={setTreeQuery}
          onExpandedKeysChange={setExpandedKeys}
          onCheckedKeysChange={setCheckedKeys}
          onSelectCase={(category, title) => update({ category, title })}
          onRunCase={(item) => void handleRunSpecificCase(item)}
          onRunCategory={(category) => void handleRunCategory(category)}
          onBatchRun={() => void handleBatchRun()}
        />
      </div>

      <div className='benchmark-view__divider' />

      <div className='benchmark-view__right'>
        <BenchmarkCasePanel
          selectedCase={selectedCase}
          latestResult={latestResult}
          activeRun={activeRun}
          activeRunId={activeRunId}
          progressPercent={progressPercent}
          onRunCase={() => void (selectedCase && handleRunSpecificCase(selectedCase))}
        />
      </div>
    </div>
  )
}
