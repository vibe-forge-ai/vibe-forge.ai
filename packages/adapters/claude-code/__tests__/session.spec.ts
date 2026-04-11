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
  autoExit?: boolean
} = {}) {
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  const stdin = new PassThrough()
  const handlers = new Map<string, (...args: any[]) => void>()
  const stdinWrites: string[] = []

  stdin.on('data', (chunk) => {
    stdinWrites.push(String(chunk))
  })

  const proc = {
    stdout,
    stderr,
    stdin,
    pid: 1234,
    stdinWrites,
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
    if (options.autoExit !== false) {
      handlers.get('exit')?.(options.exitCode ?? 0)
    }
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

  it('retries missing resume sessions in create mode and replays the pending prompt', async () => {
    const ctx = makeCtx()
    const firstProc = makeProc({
      stdout: [
        `${
          JSON.stringify({
            type: 'result',
            subtype: 'error_during_execution',
            uuid: 'evt-missing',
            timestamp: new Date().toISOString(),
            sessionId: 'sess-1',
            cwd: '/tmp',
            session_id: 'sess-1',
            errors: ['No conversation found with session ID: sess-1']
          })
        }\n`
      ],
      autoExit: false
    })
    const secondProc = makeProc({ autoExit: false })

    mocks.prepareClaudeExecution.mockResolvedValue({
      cliPath: 'claude',
      args: ['run', '--resume', 'sess-1'],
      env: {},
      cwd: '/tmp',
      sessionId: 'sess-1',
      executionType: 'resume'
    })
    spawnMock
      .mockImplementationOnce(() => firstProc)
      .mockImplementationOnce(() => secondProc)

    const events: AdapterOutputEvent[] = []
    await createClaudeSession(ctx, {
      type: 'resume',
      runtime: 'server',
      mode: 'stream',
      sessionId: 'sess-1',
      description: 'follow up',
      onEvent: (event: AdapterOutputEvent) => events.push(event)
    } as any)

    await new Promise(resolve => setTimeout(resolve, 10))
    const exitHandler = firstProc.on.mock.calls.find(
      (call: [string, (...args: unknown[]) => void]) => call[0] === 'exit'
    )?.[1]
    exitHandler?.(1)

    for (let attempt = 0; attempt < 20 && spawnMock.mock.calls.length < 2; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 10))
    }

    expect(spawnMock).toHaveBeenCalledTimes(2)
    expect(spawnMock.mock.calls[0]?.[1]).toContain('--resume')
    expect(spawnMock.mock.calls[1]?.[1]).toContain('--session-id')
    expect(spawnMock.mock.calls[1]?.[1]).not.toContain('--resume')
    expect(ctx.cache.set).toHaveBeenCalledWith('adapter.claude-code.resume-state', { canResume: false })
    expect(secondProc.stdinWrites.join('')).toContain('"follow up"')
    expect(events).toEqual([])
  })
})
