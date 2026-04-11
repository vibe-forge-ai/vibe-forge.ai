import { mkdir, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resolveSessionBase } from '#~/runtime/session-common.js'

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os')
  return {
    ...actual,
    homedir: vi.fn()
  }
})

const tempDirs: string[] = []

describe('resolveSessionBase', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { force: true, recursive: true })))
  })

  it('falls back to os.homedir when HOME is unset', async () => {
    const fakeHome = join(tmpdir(), `codex-home-${Date.now()}`)
    tempDirs.push(fakeHome)
    await mkdir(fakeHome, { recursive: true })

    vi.mocked(homedir).mockReturnValue(fakeHome)
    vi.stubEnv('HOME', undefined)

    const base = await resolveSessionBase({
      ctxId: 'ctx-home',
      cwd: '/tmp',
      env: {},
      cache: {
        set: vi.fn(async () => ({ cachePath: '/tmp/cache.json' })) as any,
        get: vi.fn(async () => undefined) as any
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      } as any,
      configs: [undefined, undefined]
    }, {
      type: 'create',
      runtime: 'cli',
      sessionId: 'sess-home',
      onEvent: vi.fn()
    })

    expect(base.binaryPath).toBeTruthy()
    await expect(mkdir(join(fakeHome, '.codex'), { recursive: false })).rejects.toMatchObject({
      code: 'EEXIST'
    })
  })

  it('routes builtin passthrough models through ChatGPT Codex backend for chatgpt auth mode', async () => {
    const fakeHome = join(tmpdir(), `codex-home-chatgpt-${Date.now()}`)
    tempDirs.push(fakeHome)
    await mkdir(join(fakeHome, '.codex'), { recursive: true })
    await writeFile(
      join(fakeHome, '.codex', 'auth.json'),
      JSON.stringify({ auth_mode: 'chatgpt' }),
      'utf8'
    )

    const base = await resolveSessionBase({
      ctxId: 'ctx-chatgpt-auth',
      cwd: '/tmp',
      env: { HOME: fakeHome },
      cache: {
        set: vi.fn(async () => ({ cachePath: '/tmp/cache.json' })) as any,
        get: vi.fn(async () => undefined) as any
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      } as any,
      configs: [
        {
          adapters: {
            codex: {
              nativeModelSwitch: true,
              nativeModelSwitchBootstrap: true
            }
          }
        },
        undefined
      ]
    }, {
      type: 'create',
      runtime: 'cli',
      sessionId: 'sess-chatgpt-auth',
      onEvent: vi.fn()
    })

    const builtinRoute = base.nativeCatalog?.routes.find(route => route.kind === 'builtin_passthrough')
    expect(builtinRoute?.upstreamBaseUrl).toBe('https://chatgpt.com/backend-api/codex')
  })

  it('keeps builtin passthrough models on public API base when auth mode is not chatgpt', async () => {
    const fakeHome = join(tmpdir(), `codex-home-api-${Date.now()}`)
    tempDirs.push(fakeHome)
    await mkdir(join(fakeHome, '.codex'), { recursive: true })
    await writeFile(
      join(fakeHome, '.codex', 'auth.json'),
      JSON.stringify({ auth_mode: 'apikey' }),
      'utf8'
    )

    const base = await resolveSessionBase({
      ctxId: 'ctx-api-auth',
      cwd: '/tmp',
      env: { HOME: fakeHome },
      cache: {
        set: vi.fn(async () => ({ cachePath: '/tmp/cache.json' })) as any,
        get: vi.fn(async () => undefined) as any
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      } as any,
      configs: [
        {
          adapters: {
            codex: {
              nativeModelSwitch: true,
              nativeModelSwitchBootstrap: true
            }
          }
        },
        undefined
      ]
    }, {
      type: 'create',
      runtime: 'cli',
      sessionId: 'sess-api-auth',
      onEvent: vi.fn()
    })

    const builtinRoute = base.nativeCatalog?.routes.find(route => route.kind === 'builtin_passthrough')
    expect(builtinRoute?.upstreamBaseUrl).toBe('https://api.openai.com/v1')
  })
})
