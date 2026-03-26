import { PassThrough } from 'node:stream'

import { spawn } from 'node:child_process'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AdapterOutputEvent } from '@vibe-forge/core/adapter'

import { createCodexSession } from '#~/runtime/session.js'

vi.mock('node:child_process', () => ({
  spawn: vi.fn()
}))

const spawnMock = vi.mocked(spawn)

function makeMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}

function makeCtx(overrides: {
  env?: Record<string, string>
  configs?: [unknown?, unknown?]
} = {}) {
  const cacheStore = new Map<string, unknown>()
  return {
    ctxId: 'test-ctx',
    cwd: '/tmp',
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

function makeProc(options: {
  resumeError?: { code: number; message: string }
  turnStartErrors?: Record<number, { code: number; message: string }>
  threadStartIds?: string[]
  resumedThreadId?: string
} = {}) {
  const stdin = new PassThrough()
  const stdout = new PassThrough()
  const receivedLines: any[] = []
  let turnCount = 0
  let threadStartCount = 0
  let exitHandler: ((code: number | null) => void) | undefined

  stdin.on('data', (chunk: unknown) => {
    const text = String(chunk)
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue

      const message = JSON.parse(trimmed)
      receivedLines.push(message)

      if (typeof message.id !== 'number') continue

      if (message.method === 'initialize') {
        stdout.push(`${JSON.stringify({ id: message.id, result: { userAgent: 'codex/1.0' } })}\n`)
      } else if (message.method === 'thread/start') {
        threadStartCount += 1
        const threadId = options.threadStartIds?.[threadStartCount - 1] ?? `thr_${threadStartCount}`
        stdout.push(`${JSON.stringify({ id: message.id, result: { thread: { id: threadId } } })}\n`)
      } else if (message.method === 'thread/resume') {
        if (options.resumeError) {
          stdout.push(`${JSON.stringify({ id: message.id, error: options.resumeError })}\n`)
        } else {
          stdout.push(
            `${
              JSON.stringify({ id: message.id, result: { thread: { id: options.resumedThreadId ?? 'thr_resumed' } } })
            }\n`
          )
        }
      } else if (message.method === 'turn/start') {
        turnCount += 1
        const turnError = options.turnStartErrors?.[turnCount]
        if (turnError) {
          stdout.push(`${JSON.stringify({ id: message.id, error: turnError })}\n`)
        } else {
          stdout.push(`${JSON.stringify({ id: message.id, result: { turn: { id: `turn_${turnCount}` } } })}\n`)
        }
      } else if (message.method === 'turn/steer' || message.method === 'turn/interrupt') {
        stdout.push(`${JSON.stringify({ id: message.id, result: {} })}\n`)
      }
    }
  })

  const proc = {
    stdin,
    stdout,
    pid: 1234,
    on: (event: string, cb: (code: number | null) => void) => {
      if (event === 'exit') exitHandler = cb
      return proc
    },
    kill: vi.fn(() => {
      exitHandler?.(0)
      return true
    })
  } as any

  return { proc, receivedLines }
}

async function waitForWrites() {
  await new Promise(resolve => setTimeout(resolve, 20))
}

function getConfigOverrides(spawnArgs: string[]) {
  return spawnArgs.filter((_, index) => spawnArgs[index - 1] === '-c')
}

describe('createCodexSession RPC approval policy mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    delete process.env.HOME
  })

  it('maps default permission mode to untrusted for outgoing RPC requests', async () => {
    process.env.HOME = '/tmp'
    const { proc, receivedLines } = makeProc()
    spawnMock.mockReturnValue(proc)

    const events: AdapterOutputEvent[] = []
    const session = await createCodexSession(makeCtx(), {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-default',
      description: 'Reply with pong.',
      onEvent: (event) => events.push(event)
    } as any)

    const startRequest = receivedLines.find(line => line.method === 'thread/start')
    expect(startRequest?.params.approvalPolicy).toBe('untrusted')

    const initialTurnRequest = receivedLines.find(line => line.method === 'turn/start')
    expect(initialTurnRequest?.params.approvalPolicy).toBe('untrusted')

    session.emit({
      type: 'message',
      content: [{ type: 'text', text: 'next turn' }]
    } as any)

    await waitForWrites()

    const turnRequests = receivedLines.filter(line => line.method === 'turn/start')
    expect(turnRequests).toHaveLength(2)
    expect(turnRequests[1]?.params.approvalPolicy).toBe('untrusted')

    session.kill()
    expect(events.some(event => event.type === 'exit')).toBe(true)
  })

  it('maps plan permission mode to on-request for outgoing RPC requests', async () => {
    process.env.HOME = '/tmp'
    const { proc, receivedLines } = makeProc()
    spawnMock.mockReturnValue(proc)

    const session = await createCodexSession(makeCtx(), {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-plan',
      permissionMode: 'plan',
      description: 'Reply with pong.',
      onEvent: () => {}
    } as any)

    const startRequest = receivedLines.find(line => line.method === 'thread/start')
    expect(startRequest?.params.approvalPolicy).toBe('on-request')

    const initialTurnRequest = receivedLines.find(line => line.method === 'turn/start')
    expect(initialTurnRequest?.params.approvalPolicy).toBe('on-request')

    session.kill()
  })

  it('keeps never unchanged for outgoing RPC requests', async () => {
    process.env.HOME = '/tmp'
    const { proc, receivedLines } = makeProc()
    spawnMock.mockReturnValue(proc)

    const session = await createCodexSession(makeCtx(), {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-never',
      permissionMode: 'dontAsk',
      description: 'Reply with pong.',
      onEvent: () => {}
    } as any)

    const startRequest = receivedLines.find(line => line.method === 'thread/start')
    expect(startRequest?.params.approvalPolicy).toBe('never')
    expect(startRequest?.params.sandboxPolicy).toEqual({ type: 'workspaceWrite' })

    const initialTurnRequest = receivedLines.find(line => line.method === 'turn/start')
    expect(initialTurnRequest?.params.approvalPolicy).toBe('never')
    expect(initialTurnRequest?.params.sandboxPolicy).toEqual({ type: 'workspaceWrite' })

    const spawnArgs = spawnMock.mock.calls[0]?.[1] as string[]
    expect(spawnArgs[0]).toBe('app-server')
    expect(spawnArgs).not.toContain('--yolo')

    session.kill()
  })

  it('uses --yolo and danger-full-access when permission mode is bypassPermissions', async () => {
    process.env.HOME = '/tmp'
    const { proc, receivedLines } = makeProc()
    spawnMock.mockReturnValue(proc)

    const session = await createCodexSession(makeCtx(), {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-bypass',
      permissionMode: 'bypassPermissions',
      description: 'Reply with pong.',
      onEvent: () => {}
    } as any)

    const spawnArgs = spawnMock.mock.calls[0]?.[1] as string[]
    expect(spawnArgs[0]).toBe('--yolo')
    expect(spawnArgs[1]).toBe('app-server')

    const startRequest = receivedLines.find(line => line.method === 'thread/start')
    expect(startRequest?.params.approvalPolicy).toBe('never')
    expect(startRequest?.params.sandboxPolicy).toEqual({ type: 'dangerFullAccess' })

    const initialTurnRequest = receivedLines.find(line => line.method === 'turn/start')
    expect(initialTurnRequest?.params.approvalPolicy).toBe('never')
    expect(initialTurnRequest?.params.sandboxPolicy).toEqual({ type: 'dangerFullAccess' })

    session.kill()
  })

  it('uses codex defaults when model is "default"', async () => {
    process.env.HOME = '/tmp'
    const { proc, receivedLines } = makeProc()
    spawnMock.mockReturnValue(proc)

    const session = await createCodexSession(
      makeCtx({
        configs: [{
          modelServices: {
            'gpt-responses': {
              title: 'GPT Responses',
              apiBaseUrl: 'http://example.test/responses',
              apiKey: 'test-key',
              extra: {
                codex: {
                  wireApi: 'responses'
                }
              }
            }
          }
        }, undefined]
      }),
      {
        type: 'create',
        runtime: 'server',
        sessionId: 'session-model-default',
        model: 'default',
        description: 'Reply with pong.',
        onEvent: () => {}
      } as any
    )

    const spawnArgs = spawnMock.mock.calls[0]?.[1] as string[]
    expect(spawnArgs.some(arg => arg.includes('model_provider='))).toBe(false)
    expect(spawnArgs.some(arg => arg.includes('model_providers.'))).toBe(false)

    const startRequest = receivedLines.find(line => line.method === 'thread/start')
    expect(startRequest?.params.model).toBeUndefined()

    const initialTurnRequest = receivedLines.find(line => line.method === 'turn/start')
    expect(initialTurnRequest?.params.model).toBeUndefined()

    session.kill()
  })

  it('passes through codex model provider headers as config overrides', async () => {
    process.env.HOME = '/tmp'
    const { proc } = makeProc()
    spawnMock.mockReturnValue(proc)

    const session = await createCodexSession(
      makeCtx({
        configs: [{
          modelServices: {
            azure: {
              title: 'Azure',
              apiBaseUrl: 'https://example.openai.azure.com/openai',
              apiKey: 'test-key',
              extra: {
                codex: {
                  wireApi: 'responses',
                  headers: {
                    'X-Tenant': 'tenant-1'
                  },
                  queryParams: {
                    'api-version': '2025-04-01-preview'
                  }
                }
              }
            }
          }
        }, undefined]
      }),
      {
        type: 'create',
        runtime: 'server',
        sessionId: 'session-provider-options',
        model: 'azure,gpt-5.4',
        description: 'Reply with pong.',
        onEvent: () => {}
      } as any
    )

    const spawnArgs = spawnMock.mock.calls[0]?.[1] as string[]
    const overrides = getConfigOverrides(spawnArgs)

    expect(overrides).toContain('model_provider="azure"')
    expect(overrides).toContain('model_providers.azure.name="Azure"')
    expect(overrides).toContain('model_providers.azure.base_url="https://example.openai.azure.com/openai"')
    expect(overrides).toContain('model_providers.azure.experimental_bearer_token="test-key"')
    expect(overrides).toContain('model_providers.azure.wire_api="responses"')
    expect(overrides).toContain('model_providers.azure.http_headers={X-Tenant = "tenant-1"}')
    expect(overrides).toContain('model_providers.azure.query_params={ak = "test-key", api-version = "2025-04-01-preview"}')

    session.kill()
  })

  it('recreates the thread when resume hits invalid_encrypted_content', async () => {
    process.env.HOME = '/tmp'
    const ctx = makeCtx()

    const firstProc = makeProc({ threadStartIds: ['thr_original'] })
    const secondProc = makeProc({
      resumeError: {
        code: -4003,
        message: 'code: invalid_encrypted_content; message: organization_id did not match the target organization'
      },
      threadStartIds: ['thr_recovered']
    })
    spawnMock
      .mockReturnValueOnce(firstProc.proc)
      .mockReturnValueOnce(secondProc.proc)

    const firstSession = await createCodexSession(ctx, {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-resume-recover',
      onEvent: () => {}
    } as any)
    firstSession.kill()

    const secondSession = await createCodexSession(ctx, {
      type: 'resume',
      runtime: 'server',
      sessionId: 'session-resume-recover',
      description: 'retry on a fresh thread',
      onEvent: () => {}
    } as any)

    await waitForWrites()
    secondSession.kill()

    expect(secondProc.receivedLines.some(line => line.method === 'thread/resume')).toBe(true)
    expect(secondProc.receivedLines.some(line => line.method === 'thread/start')).toBe(true)

    const cachedThreads = await ctx.cache.get('adapter.codex.threads')
    expect(Object.values(cachedThreads ?? {})).toContain('thr_recovered')
    expect(Object.values(cachedThreads ?? {})).not.toContain('thr_original')
  })

  it('emits exit when a post-start turn fails', async () => {
    process.env.HOME = '/tmp'
    const { proc } = makeProc({
      turnStartErrors: {
        2: { code: -4003, message: 'code: invalid_encrypted_content; message: broken thread state' }
      }
    })
    spawnMock.mockReturnValue(proc)

    const events: AdapterOutputEvent[] = []
    const session = await createCodexSession(makeCtx(), {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-turn-failure',
      description: 'first turn works',
      onEvent: (event) => events.push(event)
    } as any)

    session.emit({
      type: 'message',
      content: [{ type: 'text', text: 'second turn fails' }]
    } as any)

    await waitForWrites()

    expect(events.some(event => (
      event.type === 'exit' &&
      event.data.exitCode === 1 &&
      event.data.stderr?.includes('invalid_encrypted_content')
    ))).toBe(true)
  })

  it('places --yolo before resume in direct mode for bypassPermissions', async () => {
    process.env.HOME = '/tmp'
    const { proc } = makeProc()
    spawnMock.mockReturnValue(proc)

    const session = await createCodexSession(makeCtx(), {
      type: 'resume',
      mode: 'direct',
      runtime: 'server',
      sessionId: 'session-direct-bypass',
      permissionMode: 'bypassPermissions',
      description: 'resume prompt',
      onEvent: () => {}
    } as any)

    const spawnArgs = spawnMock.mock.calls[0]?.[1] as string[]
    expect(spawnArgs[0]).toBe('--yolo')
    expect(spawnArgs[1]).toBe('resume')
    expect(spawnArgs).toContain('--last')
    expect(spawnArgs).not.toContain('--ask-for-approval')
    expect(spawnArgs).not.toContain('--sandbox')

    session.kill()
  })
})
