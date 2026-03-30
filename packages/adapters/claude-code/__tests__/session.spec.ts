import { PassThrough } from 'node:stream'

import { spawn } from 'node:child_process'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AdapterOutputEvent } from '@vibe-forge/types'

import { createClaudeSession } from '../src/claude/session'

const mocks = vi.hoisted(() => ({
  prepareClaudeExecution: vi.fn()
}))

vi.mock('node:child_process', () => ({
  spawn: vi.fn()
}))

vi.mock('../src/claude/prepare', () => ({
  prepareClaudeExecution: mocks.prepareClaudeExecution
}))

const spawnMock = vi.mocked(spawn)

function makeCtx() {
  return {
    ctxId: 'ctx',
    cwd: '/tmp',
    env: {},
    cache: {
      set: vi.fn(async () => ({ cachePath: '/tmp/cache.json' })),
      get: vi.fn(async () => undefined)
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    },
    configs: [undefined, undefined]
  } as any
}

function makeProc(options: {
  stdout?: string[]
  stderr?: string[]
  exitCode?: number
  error?: Error
} = {}) {
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  const handlers = new Map<string, (...args: any[]) => void>()

  const proc = {
    stdout,
    stderr,
    stdin: new PassThrough(),
    pid: 1234,
    on: vi.fn((event: string, handler: (...args: any[]) => void) => {
      handlers.set(event, handler)
      return proc
    }),
    kill: vi.fn(() => {
      handlers.get('exit')?.(0)
      return true
    })
  } as any

  queueMicrotask(() => {
    for (const line of options.stdout ?? []) {
      stdout.write(line)
    }
    for (const line of options.stderr ?? []) {
      stderr.write(line)
    }
    if (options.error) {
      handlers.get('error')?.(options.error)
      return
    }
    handlers.get('exit')?.(options.exitCode ?? 0)
  })

  return proc
}

describe('claude-code session error events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prepareClaudeExecution.mockResolvedValue({
      cliPath: 'claude',
      args: ['run'],
      env: {},
      cwd: '/tmp',
      sessionId: 'sess-1',
      executionType: 'create'
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('emits error before exit for non-zero stream exits', async () => {
    spawnMock.mockImplementation(() =>
      makeProc({
        stderr: ['stream failed'],
        exitCode: 1
      })
    )

    const events: AdapterOutputEvent[] = []
    await createClaudeSession(makeCtx(), {
      type: 'create',
      runtime: 'server',
      mode: 'stream',
      sessionId: 'sess-1',
      onEvent: (event: AdapterOutputEvent) => events.push(event)
    } as any)

    await new Promise(resolve => setTimeout(resolve, 10))

    expect(events).toEqual([
      {
        type: 'error',
        data: {
          message: 'stream failed',
          details: { stderr: 'stream failed' },
          fatal: true
        }
      },
      {
        type: 'exit',
        data: {
          exitCode: 1,
          stderr: 'stream failed'
        }
      }
    ])
  })

  it('does not emit a duplicate fatal error after error_during_execution is already surfaced', async () => {
    spawnMock.mockImplementation(() =>
      makeProc({
        stdout: [
          `${
            JSON.stringify({
              type: 'result',
              subtype: 'error_during_execution',
              uuid: 'evt-1',
              timestamp: new Date().toISOString(),
              sessionId: 'sess-1',
              cwd: '/tmp',
              session_id: 'sess-1',
              errors: ['tool failed']
            })
          }\n`
        ],
        exitCode: 1
      })
    )

    const events: AdapterOutputEvent[] = []
    await createClaudeSession(makeCtx(), {
      type: 'create',
      runtime: 'server',
      mode: 'stream',
      sessionId: 'sess-1',
      onEvent: (event: AdapterOutputEvent) => events.push(event)
    } as any)

    await new Promise(resolve => setTimeout(resolve, 10))

    expect(events.filter((event: AdapterOutputEvent) => event.type === 'error')).toHaveLength(1)
    expect(events.at(-1)).toEqual({
      type: 'exit',
      data: {
        exitCode: 1,
        stderr: ''
      }
    })
  })
})
