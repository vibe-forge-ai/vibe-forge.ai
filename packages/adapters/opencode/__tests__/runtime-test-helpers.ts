import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { PassThrough } from 'node:stream'

import { afterEach, beforeEach, vi } from 'vitest'

const tempDirs: string[] = []

function makeMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}

export function registerRuntimeTestHooks() {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    delete process.env.HOME
  })

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
  })
}

export function makeCtx(overrides: {
  env?: Record<string, string | null | undefined>
  configs?: [unknown?, unknown?]
  cacheSeed?: Record<string, unknown>
  cwd?: string
} = {}) {
  const cacheStore = new Map<string, unknown>(Object.entries(overrides.cacheSeed ?? {}))

  return {
    cacheStore,
    ctx: {
      ctxId: 'test-ctx',
      cwd: overrides.cwd ?? '/tmp',
      env: overrides.env ?? {},
      cache: {
        set: async (key: string, value: unknown) => {
          cacheStore.set(key, value)
          return { cachePath: `/tmp/${key}.json` }
        },
        get: async (key: string) => cacheStore.get(key)
      },
      logger: makeMockLogger(),
      configs: overrides.configs ?? [undefined, undefined]
    } as any
  }
}

export const createWorkspace = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'opencode-adapter-'))
  tempDirs.push(dir)
  return dir
}

export const writeDocument = async (filePath: string, content: string) => {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, content)
}

export function makeProc(options: {
  stdout?: string
  stderr?: string
  exitCode?: number
  pid?: number
} = {}) {
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  const handlers = new Map<string, (...args: any[]) => void>()

  const proc = {
    stdout,
    stderr,
    pid: options.pid ?? 4321,
    on: vi.fn((event: string, handler: (...args: any[]) => void) => {
      handlers.set(event, handler)
      return proc
    }),
    kill: vi.fn(() => {
      queueMicrotask(() => handlers.get('exit')?.(130))
      return true
    })
  } as any

  queueMicrotask(() => {
    if (options.stdout) stdout.write(options.stdout)
    stdout.end()
    if (options.stderr) stderr.write(options.stderr)
    stderr.end()
    handlers.get('exit')?.(options.exitCode ?? 0)
  })

  return proc
}

export function makeErrorProc(error: Error) {
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  const handlers = new Map<string, (...args: any[]) => void>()

  const proc = {
    stdout,
    stderr,
    pid: 4321,
    on: vi.fn((event: string, handler: (...args: any[]) => void) => {
      handlers.set(event, handler)
      return proc
    }),
    kill: vi.fn(() => true)
  } as any

  queueMicrotask(() => handlers.get('error')?.(error))
  return proc
}

export function mockExecFileJsonResponses(
  execFileMock: { mockImplementation: (impl: (...args: unknown[]) => unknown) => unknown },
  ...payloads: unknown[]
) {
  execFileMock.mockImplementation(((...args: unknown[]) => {
    const callback = args.at(-1) as ((err: Error | null, stdout: string, stderr: string) => void) | undefined
    const payload = payloads.shift() ?? []
    queueMicrotask(() => {
      callback?.(null, JSON.stringify(payload), '')
    })
    return {} as any
  }) as any)
}

export async function flushAsyncWork() {
  await new Promise(resolve => setTimeout(resolve, 50))
}
