import { randomUUID } from 'node:crypto'
import process from 'node:process'

import {
  getBenchmarkCase,
  listBenchmarkCases,
  listBenchmarkCategories,
  listBenchmarkResults,
  readBenchmarkResult,
  runBenchmarkCase,
  runBenchmarkCategory
} from '@vibe-forge/app-runtime'
import type { BenchmarkRunSummary, SessionPermissionMode } from '@vibe-forge/types'

import { badRequest, notFound } from '#~/utils/http.js'

const runRegistry = new Map<string, BenchmarkRunSummary>()

interface BenchmarkRunInput {
  adapter?: string
  category?: string
  concurrency?: number
  effort?: 'low' | 'medium' | 'high' | 'max'
  model?: string
  permissionMode?: SessionPermissionMode
  systemPrompt?: string
  title?: string
}

const upsertRun = (run: BenchmarkRunSummary) => {
  runRegistry.set(run.runId, run)
  return run
}

const markRunMessage = (runId: string, message: string) => {
  const current = runRegistry.get(runId)
  if (current == null) return
  runRegistry.set(runId, {
    ...current,
    lastMessage: message
  })
}

const incrementCompletedCount = (runId: string) => {
  const current = runRegistry.get(runId)
  if (current == null) return
  runRegistry.set(runId, {
    ...current,
    completedCount: (current.completedCount ?? 0) + 1
  })
}

export const listBenchmarkCategorySummaries = async () => ({
  categories: await listBenchmarkCategories()
})

export const listBenchmarkCaseSummaries = async (params: { category?: string }) => ({
  cases: await listBenchmarkCases({ category: params.category })
})

export const getBenchmarkCaseDetail = async (params: { category: string; title: string }) => {
  const caseItem = await getBenchmarkCase(params)
  if (caseItem == null) {
    throw notFound('Benchmark case not found', params, 'benchmark_case_not_found')
  }
  return { case: caseItem }
}

export const listBenchmarkResultSummaries = async (params: { category?: string; title?: string }) => {
  const results = await listBenchmarkResults(undefined, params.category)
  return {
    results: params.title == null
      ? results
      : results.filter((item: { title: string }) => item.title === params.title)
  }
}

export const getBenchmarkResultDetail = async (params: { category: string; title: string }) => {
  const result = await readBenchmarkResult(process.cwd(), params.category, params.title)
  if (result == null) {
    throw notFound('Benchmark result not found', params, 'benchmark_result_not_found')
  }
  return { result }
}

export const getBenchmarkRunDetail = (runId: string) => {
  const run = runRegistry.get(runId)
  if (run == null) {
    throw notFound('Benchmark run not found', { runId }, 'benchmark_run_not_found')
  }
  return { run }
}

export const startBenchmarkRun = async (input: BenchmarkRunInput) => {
  const category = (input.category ?? '').trim()
  const title = (input.title ?? '').trim()
  if (category === '') {
    throw badRequest('category is required', undefined, 'category_required')
  }

  const runId = randomUUID()
  const availableCases = await listBenchmarkCases({ category })
  const targetCases = title === ''
    ? availableCases
    : availableCases.filter((item: { title: string }) => item.title === title)

  if (targetCases.length === 0) {
    throw notFound('No benchmark cases matched the request', { category, title }, 'benchmark_cases_not_found')
  }

  const initialRun = upsertRun({
    runId,
    category,
    title: title || undefined,
    status: 'queued',
    startedAt: Date.now(),
    totalCount: targetCases.length,
    completedCount: 0,
    lastMessage: 'Benchmark queued'
  })

  void (async () => {
    upsertRun({
      ...initialRun,
      status: 'running',
      lastMessage: 'Benchmark running'
    })

    try {
      if (title !== '') {
        const output = await runBenchmarkCase({
          category,
          title,
          adapter: input.adapter,
          model: input.model,
          effort: input.effort,
          systemPrompt: input.systemPrompt,
          permissionMode: input.permissionMode,
          runtime: 'server',
          runId,
          onEvent: (event: { message: string; phase: string }) => {
            markRunMessage(runId, event.message)
            if (event.phase === 'result') {
              incrementCompletedCount(runId)
            }
          }
        })

        upsertRun({
          runId,
          category,
          title,
          status: 'completed',
          startedAt: initialRun.startedAt,
          finishedAt: Date.now(),
          totalCount: 1,
          completedCount: 1,
          result: output.result,
          lastMessage: output.result.judgeSummary
        })
        return
      }

      const output = await runBenchmarkCategory({
        category,
        concurrency: input.concurrency,
        adapter: input.adapter,
        model: input.model,
        effort: input.effort,
        systemPrompt: input.systemPrompt,
        permissionMode: input.permissionMode,
        runtime: 'server',
        runId,
        onEvent: (event: { message: string; phase: string; scope?: string }) => {
          markRunMessage(runId, event.message)
          if (event.phase === 'result' && event.scope === 'case') {
            incrementCompletedCount(runId)
          }
        }
      })

      upsertRun({
        runId,
        category,
        status: 'completed',
        startedAt: initialRun.startedAt,
        finishedAt: Date.now(),
        totalCount: output.results.length,
        completedCount: output.results.length,
        results: output.results,
        lastMessage: 'Benchmark category run completed'
      })
    } catch (error) {
      upsertRun({
        runId,
        category,
        title: title || undefined,
        status: 'failed',
        startedAt: initialRun.startedAt,
        finishedAt: Date.now(),
        totalCount: initialRun.totalCount,
        completedCount: initialRun.completedCount,
        error: error instanceof Error ? error.message : String(error),
        lastMessage: 'Benchmark run failed'
      })
    }
  })()

  return { run: initialRun }
}
