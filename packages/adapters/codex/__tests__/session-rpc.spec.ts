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

function makeCtx() {
  const cacheStore = new Map<string, unknown>()
  return {
    ctxId: 'test-ctx',
    cwd: '/tmp',
    env: {},
    cache: {
      set: async (key: string, value: unknown) => {
        cacheStore.set(key, value)
        return { cachePath: `/tmp/${key}.json` }
      },
      get: async (key: string) => cacheStore.get(key)
    },
    logger: makeMockLogger(),
    configs: [undefined, undefined]
  } as any
}

function makeProc() {
  const stdin = new PassThrough()
  const stdout = new PassThrough()
  const receivedLines: any[] = []
  let turnCount = 0
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
        stdout.push(`${JSON.stringify({ id: message.id, result: { thread: { id: 'thr_1' } } })}\n`)
      } else if (message.method === 'turn/start') {
        turnCount += 1
        stdout.push(`${JSON.stringify({ id: message.id, result: { turn: { id: `turn_${turnCount}` } } })}\n`)
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

    const initialTurnRequest = receivedLines.find(line => line.method === 'turn/start')
    expect(initialTurnRequest?.params.approvalPolicy).toBe('never')

    session.kill()
  })
})