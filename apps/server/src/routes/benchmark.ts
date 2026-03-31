import { randomUUID } from 'node:crypto'
import process from 'node:process'

import Router from '@koa/router'

import {
  getBenchmarkCase,
  listBenchmarkCases,
  listBenchmarkCategories,
  listBenchmarkResults,
  readBenchmarkResult,
  runBenchmarkCase,
  runBenchmarkCategory
} from '@vibe-forge/app-runtime'
import type { BenchmarkRunSummary } from '@vibe-forge/types'

import { badRequest, notFound } from '#~/utils/http.js'

const runRegistry = new Map<string, BenchmarkRunSummary>()

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

export function benchmarkRouter(): Router {
  const router = new Router()

  router.get('/categories', async (ctx) => {
    ctx.body = {
      categories: await listBenchmarkCategories()
    }
  })

  router.get('/cases', async (ctx) => {
    const { category } = ctx.query as { category?: string }
    ctx.body = {
      cases: await listBenchmarkCases({ category })
    }
  })

  router.get('/cases/:category/:title', async (ctx) => {
    const { category, title } = ctx.params as { category: string; title: string }
    const caseItem = await getBenchmarkCase({ category, title })
    if (caseItem == null) {
      throw notFound('Benchmark case not found', { category, title }, 'benchmark_case_not_found')
    }
    ctx.body = { case: caseItem }
  })

  router.get('/results', async (ctx) => {
    const { category, title } = ctx.query as { category?: string; title?: string }
    const results = await listBenchmarkResults(undefined, category)
    ctx.body = {
      results: title == null ? results : results.filter((item: { title: string }) => item.title === title)
    }
  })

  router.get('/results/:category/:title', async (ctx) => {
    const { category, title } = ctx.params as { category: string; title: string }
    const result = await readBenchmarkResult(process.cwd(), category, title)
    if (result == null) {
      throw notFound('Benchmark result not found', { category, title }, 'benchmark_result_not_found')
    }
    ctx.body = { result }
  })

  router.get('/runs/:runId', (ctx) => {
    const { runId } = ctx.params as { runId: string }
    const run = runRegistry.get(runId)
    if (run == null) {
      throw notFound('Benchmark run not found', { runId }, 'benchmark_run_not_found')
    }
    ctx.body = { run }
  })

  router.post('/run', async (ctx) => {
    const body = ctx.request.body as {
      category?: string
      title?: string
      concurrency?: number
      adapter?: string
      model?: string
      effort?: 'low' | 'medium' | 'high' | 'max'
      systemPrompt?: string
      permissionMode?: 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions'
    }

    const category = (body.category ?? '').trim()
    const title = (body.title ?? '').trim()
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

    ctx.body = { run: initialRun }

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
            adapter: body.adapter,
            model: body.model,
            effort: body.effort,
            systemPrompt: body.systemPrompt,
            permissionMode: body.permissionMode,
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
          concurrency: body.concurrency,
          adapter: body.adapter,
          model: body.model,
          effort: body.effort,
          systemPrompt: body.systemPrompt,
          permissionMode: body.permissionMode,
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
  })

  return router
}
