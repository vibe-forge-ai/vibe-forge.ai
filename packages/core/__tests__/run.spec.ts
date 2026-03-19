import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  prepareMock,
  loadAdapterMock,
  callHookMock,
  initMock,
  queryMock
} = vi.hoisted(() => ({
  prepareMock: vi.fn(),
  loadAdapterMock: vi.fn(),
  callHookMock: vi.fn(),
  initMock: vi.fn(),
  queryMock: vi.fn()
}))

vi.mock('#~/controllers/task/prepare.js', () => ({
  prepare: prepareMock
}))

vi.mock('#~/adapter/index.js', () => ({
  loadAdapter: loadAdapterMock
}))

vi.mock('#~/utils/api.js', () => ({
  callHook: callHookMock
}))

import { run } from '#~/controllers/task/run.js'

const createCtx = () => ({
  ctxId: 'ctx-1',
  cwd: '/tmp/project',
  env: {},
  cache: {
    set: vi.fn().mockResolvedValue({ cachePath: '/tmp/project/.ai/cache/base.json' }),
    get: vi.fn()
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  },
  configs: [
    {
      adapters: {
        codex: {}
      }
    },
    undefined
  ]
})

describe('task run adapter init', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    initMock.mockResolvedValue(undefined)
    queryMock.mockResolvedValue({
      kill: vi.fn(),
      emit: vi.fn()
    })
    loadAdapterMock.mockResolvedValue({
      init: initMock,
      query: queryMock
    })
    callHookMock.mockResolvedValue(undefined)
  })

  it('runs adapter init before query', async () => {
    const ctx = createCtx()
    prepareMock.mockResolvedValue([ctx])

    await run({
      adapter: 'codex',
      cwd: ctx.cwd,
      env: {}
    }, {
      type: 'create',
      runtime: 'cli',
      sessionId: 'session-cli',
      description: 'hello',
      onEvent: vi.fn()
    })

    expect(loadAdapterMock).toHaveBeenCalledWith('codex')
    expect(initMock).toHaveBeenCalledTimes(1)
    expect(initMock).toHaveBeenCalledWith(ctx)
    expect(queryMock).toHaveBeenCalledTimes(1)
    const initCallOrder = initMock.mock.invocationCallOrder[0]
    const queryCallOrder = queryMock.mock.invocationCallOrder[0]
    expect(initCallOrder).toBeDefined()
    expect(queryCallOrder).toBeDefined()
    if (initCallOrder == null || queryCallOrder == null) {
      throw new Error('expected init and query to be invoked')
    }
    expect(initCallOrder).toBeLessThan(queryCallOrder)
  })

  it('also runs adapter init for non-CLI runtimes', async () => {
    const ctx = createCtx()
    prepareMock.mockResolvedValue([ctx])

    await run({
      adapter: 'codex',
      cwd: ctx.cwd,
      env: {}
    }, {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-server',
      description: 'hello',
      onEvent: vi.fn()
    })

    expect(initMock).toHaveBeenCalledTimes(1)
    expect(initMock).toHaveBeenCalledWith(ctx)
    expect(queryMock).toHaveBeenCalledTimes(1)
  })
})
