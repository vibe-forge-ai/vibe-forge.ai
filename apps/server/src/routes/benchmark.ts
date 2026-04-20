import Router from '@koa/router'
import {
  getBenchmarkCaseDetail,
  getBenchmarkResultDetail,
  getBenchmarkRunDetail,
  listBenchmarkCaseSummaries,
  listBenchmarkCategorySummaries,
  listBenchmarkResultSummaries,
  startBenchmarkRun
} from '#~/services/benchmark/index.js'

export function benchmarkRouter(): Router {
  const router = new Router()

  router.get('/categories', async (ctx) => {
    ctx.body = await listBenchmarkCategorySummaries()
  })

  router.get('/cases', async (ctx) => {
    const { category } = ctx.query as { category?: string }
    ctx.body = await listBenchmarkCaseSummaries({ category })
  })

  router.get('/cases/:category/:title', async (ctx) => {
    const { category, title } = ctx.params as { category: string; title: string }
    ctx.body = await getBenchmarkCaseDetail({ category, title })
  })

  router.get('/results', async (ctx) => {
    const { category, title } = ctx.query as { category?: string; title?: string }
    ctx.body = await listBenchmarkResultSummaries({ category, title })
  })

  router.get('/results/:category/:title', async (ctx) => {
    const { category, title } = ctx.params as { category: string; title: string }
    ctx.body = await getBenchmarkResultDetail({ category, title })
  })

  router.get('/runs/:runId', (ctx) => {
    const { runId } = ctx.params as { runId: string }
    ctx.body = getBenchmarkRunDetail(runId)
  })

  router.post('/run', async (ctx) => {
    ctx.body = await startBenchmarkRun(ctx.request.body ?? {})
  })

  return router
}
