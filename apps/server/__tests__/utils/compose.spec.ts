import { describe, expect, it, vi } from 'vitest'

import { compose } from '#~/utils/compose.js'

describe('compose', () => {
  it('calls a single middleware', async () => {
    const ctx = { value: 0 }
    const mw = vi.fn(async (_ctx: typeof ctx, next: () => Promise<void>) => {
      _ctx.value = 1
      await next()
    })

    await compose(mw)(ctx)

    expect(mw).toHaveBeenCalledOnce()
    expect(ctx.value).toBe(1)
  })

  it('calls middlewares in order', async () => {
    const order: number[] = []
    const ctx = {}

    const mw1 = async (_ctx: object, next: () => Promise<void>) => {
      order.push(1)
      await next()
      order.push(4)
    }
    const mw2 = async (_ctx: object, next: () => Promise<void>) => {
      order.push(2)
      await next()
      order.push(3)
    }

    await compose(mw1, mw2)(ctx)

    expect(order).toEqual([1, 2, 3, 4])
  })

  it('passes the same ctx object through the chain', async () => {
    const ctx = { steps: [] as string[] }

    const mw1 = async (_ctx: typeof ctx, next: () => Promise<void>) => {
      _ctx.steps.push('a')
      await next()
    }
    const mw2 = async (_ctx: typeof ctx, next: () => Promise<void>) => {
      _ctx.steps.push('b')
      await next()
    }

    await compose(mw1, mw2)(ctx)

    expect(ctx.steps).toEqual(['a', 'b'])
  })

  it('stops the chain when next() is not called', async () => {
    const ctx = { reached: false }

    const mw1 = async (_ctx: typeof ctx, _next: () => Promise<void>) => {
      // deliberately does not call next
    }
    const mw2 = async (_ctx: typeof ctx, next: () => Promise<void>) => {
      _ctx.reached = true
      await next()
    }

    await compose(mw1, mw2)(ctx)

    expect(ctx.reached).toBe(false)
  })

  it('handles an empty middleware list', async () => {
    const ctx = {}
    await expect(compose()(ctx)).resolves.toBeUndefined()
  })

  it('propagates errors thrown in middleware', async () => {
    const ctx = {}
    const boom = new Error('boom')

    const mw = async (_ctx: object, _next: () => Promise<void>) => {
      throw boom
    }

    await expect(compose(mw)(ctx)).rejects.toThrow('boom')
  })

  it('propagates errors thrown in downstream middleware', async () => {
    const ctx = {}
    const boom = new Error('downstream')

    const mw1 = async (_ctx: object, next: () => Promise<void>) => {
      await next()
    }
    const mw2 = async (_ctx: object, _next: () => Promise<void>) => {
      throw boom
    }

    await expect(compose(mw1, mw2)(ctx)).rejects.toThrow('downstream')
  })

  it('supports async work before and after next()', async () => {
    const ctx = { log: [] as string[] }

    const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

    const mw1 = async (_ctx: typeof ctx, next: () => Promise<void>) => {
      await delay(1)
      _ctx.log.push('before')
      await next()
      _ctx.log.push('after')
    }
    const mw2 = async (_ctx: typeof ctx, next: () => Promise<void>) => {
      _ctx.log.push('inner')
      await next()
    }

    await compose(mw1, mw2)(ctx)

    expect(ctx.log).toEqual(['before', 'inner', 'after'])
  })
})
