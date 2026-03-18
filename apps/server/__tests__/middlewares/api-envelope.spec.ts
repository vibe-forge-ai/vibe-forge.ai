import { afterEach, describe, expect, it, vi } from 'vitest'

import { apiEnvelopeMiddleware } from '#~/middlewares/api-envelope.js'
import { badRequest } from '#~/utils/http.js'
import { logger } from '#~/utils/logger.js'

vi.mock('#~/utils/logger.js', () => ({
  logger: {
    error: vi.fn()
  }
}))

const runMiddleware = async ({
  path = '/api/test',
  method = 'GET',
  status = 404,
  body,
  type,
  next = async () => {}
}: {
  path?: string
  method?: string
  status?: number
  body?: unknown
  type?: string
  next?: (ctx: any) => Promise<void>
} = {}) => {
  const ctx = {
    path,
    method,
    status,
    body,
    type
  } as any

  await apiEnvelopeMiddleware()(ctx, async () => next(ctx))

  return ctx
}

describe('apiEnvelopeMiddleware', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('wraps successful api responses in a success envelope', async () => {
    const ctx = await runMiddleware({
      path: '/api/sessions',
      next: async (ctx) => {
        ctx.status = 200
        ctx.body = { sessions: [{ id: 'sess-1' }] }
      }
    })

    expect(ctx.status).toBe(200)
    expect(ctx.type).toBe('application/json')
    expect(ctx.body).toEqual({
      success: true,
      data: {
        sessions: [{ id: 'sess-1' }]
      }
    })
  })

  it('preserves existing api envelopes', async () => {
    const ctx = await runMiddleware({
      path: '/api/config',
      next: async (ctx) => {
        ctx.status = 200
        ctx.body = {
          success: true,
          data: {
            ok: true
          }
        }
      }
    })

    expect(ctx.body).toEqual({
      success: true,
      data: {
        ok: true
      }
    })
  })

  it('normalizes legacy api error bodies', async () => {
    const ctx = await runMiddleware({
      path: '/api/config',
      next: async (ctx) => {
        ctx.status = 422
        ctx.body = {
          code: 'invalid_config',
          message: 'Invalid config',
          details: { section: 'model' }
        }
      }
    })

    expect(ctx.status).toBe(422)
    expect(ctx.body).toEqual({
      success: false,
      error: {
        code: 'invalid_config',
        message: 'Invalid config',
        details: { section: 'model' }
      }
    })
  })

  it('serializes thrown HttpError instances for api routes', async () => {
    const ctx = await runMiddleware({
      path: '/api/hooks',
      next: async () => {
        throw badRequest('Invalid hook payload', { field: 'hookEventName' }, 'invalid_hook_payload')
      }
    })

    expect(ctx.status).toBe(400)
    expect(ctx.body).toEqual({
      success: false,
      error: {
        code: 'invalid_hook_payload',
        message: 'Invalid hook payload',
        details: { field: 'hookEventName' }
      }
    })
  })

  it('maps unmatched api routes to a not_found envelope', async () => {
    const ctx = await runMiddleware({ path: '/api/missing' })

    expect(ctx.status).toBe(404)
    expect(ctx.body).toEqual({
      success: false,
      error: {
        code: 'not_found',
        message: 'Not Found'
      }
    })
  })

  it('hides unexpected api errors and logs them', async () => {
    const ctx = await runMiddleware({
      path: '/api/boom',
      next: async () => {
        throw new Error('database connection string leaked')
      }
    })

    expect(ctx.status).toBe(500)
    expect(ctx.body).toEqual({
      success: false,
      error: {
        code: 'internal_server_error',
        message: 'Internal Server Error'
      }
    })
    expect(vi.mocked(logger.error)).toHaveBeenCalledOnce()
  })

  it('does not wrap non-api responses', async () => {
    const ctx = await runMiddleware({
      path: '/healthz',
      next: async (ctx) => {
        ctx.status = 200
        ctx.type = 'text/plain'
        ctx.body = 'ok'
      }
    })

    expect(ctx.status).toBe(200)
    expect(ctx.type).toBe('text/plain')
    expect(ctx.body).toBe('ok')
  })
})
