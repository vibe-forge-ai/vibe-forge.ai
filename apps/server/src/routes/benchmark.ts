import { randomUUID } from 'node:crypto'
import process from 'node:process'

import Router from '@koa/router'

import type { BenchmarkRunSummary } from '@vibe-forge/core'
import {
  getBenchmarkCase,
  listBenchmarkCases,
  listBenchmarkCategories,
  listBenchmarkResults,
  readBenchmarkResult,
  runBenchmarkCase,
  runBenchmarkCategory
} from '@vibe-forge/core/controllers/benchmark'

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
      ctx.status = 404
      ctx.body = { error: 'Benchmark case not found' }
      return
    }
    ctx.body = { case: caseItem }
  })

  router.get('/results', async (ctx) => {
    const { category, title } = ctx.query as { category?: string; title?: string }
    const results = await listBenchmarkResults(undefined, category)
    ctx.body = {
      results: title == null ? results : results.filter(item => item.title === title)
    }
  })

  router.get('/results/:category/:title', async (ctx) => {
    const { category, title } = ctx.params as { category: string; title: string }
    const result = await readBenchmarkResult(process.cwd(), category, title)
    if (result == null) {
      ctx.status = 404
      ctx.body = { error: 'Benchmark result not found' }
      return
    }
    ctx.body = { result }
  })

  router.get('/runs/:runId', (ctx) => {
    const { runId } = ctx.params as { runId: string }
    const run = runRegistry.get(runId)
    if (run == null) {
      ctx.status = 404
      ctx.body = { error: 'Benchmark run not found' }
      return
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
      systemPrompt?: string
      permissionMode?: 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions'
    }

    const category = (body.category ?? '').trim()
    const title = (body.title ?? '').trim()
    if (category === '') {
      ctx.status = 400
      ctx.body = { error: 'category is required' }
      return
    }

    const runId = randomUUID()
    const availableCases = await listBenchmarkCases({ category })
    const targetCases = title === ''
      ? availableCases
      : availableCases.filter(item => item.title === title)

    if (targetCases.length === 0) {
      ctx.status = 404
      ctx.body = { error: 'No benchmark cases matched the request' }
      return
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
            systemPrompt: body.systemPrompt,
            permissionMode: body.permissionMode,
            runtime: 'server',
            runId,
            onEvent: (event) => {
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
          systemPrompt: body.systemPrompt,
          permissionMode: body.permissionMode,
          runtime: 'server',
          runId,
          onEvent: (event) => {
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
