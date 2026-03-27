import { Buffer } from 'node:buffer'
import { PassThrough } from 'node:stream'

import { spawn } from 'node:child_process'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AdapterOutputEvent } from '@vibe-forge/core/adapter'

import { createCodexSession } from '#~/runtime/session.js'
import { CODEX_PROXY_META_HEADER_NAME } from '#~/runtime/proxy.js'

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

function getConfigOverride(overrides: string[], prefix: string) {
  return overrides.find(override => override.startsWith(prefix))
}

function decodeProxyMeta(overrides: string[], serviceKey: string) {
  const headerOverride = getConfigOverride(overrides, `model_providers.${serviceKey}.http_headers=`)
  if (headerOverride == null) {
    throw new Error(`Missing http_headers override for ${serviceKey}`)
  }

  const encodedMeta = headerOverride.match(new RegExp(`${CODEX_PROXY_META_HEADER_NAME} = "([^"]+)"`))?.[1]
  if (encodedMeta == null) {
    throw new Error(`Missing ${CODEX_PROXY_META_HEADER_NAME} header for ${serviceKey}`)
  }

  return JSON.parse(Buffer.from(encodedMeta, 'base64url').toString('utf8')) as Record<string, unknown>
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
      onEvent: (event: AdapterOutputEvent) => events.push(event)
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
    expect(events.some((event: AdapterOutputEvent) => event.type === 'exit')).toBe(true)
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

  it('enables native codex hooks and injects runtime metadata when available', async () => {
    process.env.HOME = '/tmp'
    const { proc } = makeProc()
    spawnMock.mockReturnValue(proc)

    const session = await createCodexSession(makeCtx({
      env: {
        __VF_PROJECT_AI_CODEX_NATIVE_HOOKS_AVAILABLE__: '1',
        __VF_PROJECT_CLI_PACKAGE_DIR__: '/tmp/vibe-forge-cli'
      }
    }), {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-native-hooks',
      description: 'Reply with pong.',
      onEvent: () => {}
    } as any)

    const spawnArgs = spawnMock.mock.calls[0]?.[1] as string[]
    const spawnOptions = spawnMock.mock.calls[0]?.[2] as { env?: Record<string, string> }

    expect(spawnArgs).toEqual(expect.arrayContaining(['--enable', 'codex_hooks']))
    expect(spawnOptions.env?.__VF_VIBE_FORGE_CODEX_HOOKS_ACTIVE__).toBe('1')
    expect(spawnOptions.env?.__VF_CODEX_HOOK_RUNTIME__).toBe('server')
    expect(spawnOptions.env?.__VF_CODEX_TASK_SESSION_ID__).toBe('session-native-hooks')

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

  it('routes codex model providers through the local proxy with upstream metadata', async () => {
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
              timeoutMs: 600000,
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
    const proxyMeta = decodeProxyMeta(overrides, 'azure')

    expect(overrides).toContain('model_provider="azure"')
    expect(overrides).toContain('model_providers.azure.name="Azure"')
    expect(overrides).toContain('model_providers.azure.experimental_bearer_token="test-key"')
    expect(overrides).toContain('model_providers.azure.wire_api="responses"')
    expect(overrides).toContain('model_providers.azure.stream_idle_timeout_ms=600000')
    expect(getConfigOverride(overrides, 'model_providers.azure.base_url=')).toMatch(
      /^model_providers\.azure\.base_url="http:\/\/127\.0\.0\.1:\d+"$/
    )
    expect(overrides.some(override => override.startsWith('model_providers.azure.query_params='))).toBe(false)
    expect(proxyMeta).toMatchObject({
      upstreamBaseUrl: 'https://example.openai.azure.com/openai',
      headers: {
        'X-Tenant': 'tenant-1'
      },
      queryParams: {
        'api-version': '2025-04-01-preview'
      }
    })

    session.kill()
  })

  it('passes maxOutputTokens from adapter config to turn/start', async () => {
    process.env.HOME = '/tmp'
    const { proc, receivedLines } = makeProc()
    spawnMock.mockReturnValue(proc)

    const session = await createCodexSession(
      makeCtx({
        configs: [{
          adapters: {
            codex: {
              maxOutputTokens: 4096
            }
          }
        }, undefined]
      }),
      {
        type: 'create',
        runtime: 'server',
        sessionId: 'session-max-output-tokens',
        description: 'Reply with pong.',
        onEvent: () => {}
      } as any
    )

    const initialTurnRequest = receivedLines.find(line => line.method === 'turn/start')
    expect(initialTurnRequest?.params.maxOutputTokens).toBe(4096)

    session.kill()
  })

  it('routes model service maxOutputTokens through the proxy and suppresses adapter fallback', async () => {
    process.env.HOME = '/tmp'
    const { proc, receivedLines } = makeProc()
    spawnMock.mockReturnValue(proc)

    const session = await createCodexSession(
      makeCtx({
        configs: [{
          adapters: {
            codex: {
              maxOutputTokens: 4096
            }
          },
          modelServices: {
            azure: {
              title: 'Azure',
              apiBaseUrl: 'https://example.openai.azure.com/openai',
              apiKey: 'test-key',
              maxOutputTokens: 8192
            }
          }
        }, undefined]
      }),
      {
        type: 'create',
        runtime: 'server',
        sessionId: 'session-service-max-output-tokens',
        model: 'azure,gpt-5.4',
        description: 'Reply with pong.',
        onEvent: () => {}
      } as any
    )

    const spawnArgs = spawnMock.mock.calls[0]?.[1] as string[]
    const overrides = getConfigOverrides(spawnArgs)
    const proxyMeta = decodeProxyMeta(overrides, 'azure')
    const initialTurnRequest = receivedLines.find(line => line.method === 'turn/start')
    expect(initialTurnRequest?.params.maxOutputTokens).toBeUndefined()
    expect(proxyMeta).toMatchObject({
      upstreamBaseUrl: 'https://example.openai.azure.com/openai',
      maxOutputTokens: 8192
    })

    session.kill()
  })

  it('passes model service maxOutputTokens to direct mode through proxy metadata', async () => {
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
              maxOutputTokens: 8192
            }
          }
        }, undefined]
      }),
      {
        type: 'create',
        mode: 'direct',
        runtime: 'server',
        sessionId: 'session-direct-service-max-output-tokens',
        model: 'azure,gpt-5.4',
        description: 'Reply with pong.',
        onEvent: () => {}
      } as any
    )

    const spawnArgs = spawnMock.mock.calls[0]?.[1] as string[]
    const overrides = getConfigOverrides(spawnArgs)
    const proxyMeta = decodeProxyMeta(overrides, 'azure')

    expect(overrides).toContain('model_provider="azure"')
    expect(getConfigOverride(overrides, 'model_providers.azure.base_url=')).toMatch(
      /^model_providers\.azure\.base_url="http:\/\/127\.0\.0\.1:\d+"$/
    )
    expect(overrides.some(override => override.startsWith('model_providers.azure.max_output_tokens='))).toBe(false)
    expect(proxyMeta).toMatchObject({
      upstreamBaseUrl: 'https://example.openai.azure.com/openai',
      maxOutputTokens: 8192
    })
    expect(spawnArgs).toContain('--model')
    expect(spawnArgs).toContain('gpt-5.4')

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
      onEvent: (event: AdapterOutputEvent) => events.push(event)
    } as any)

    session.emit({
      type: 'message',
      content: [{ type: 'text', text: 'second turn fails' }]
    } as any)

    await waitForWrites()

    expect(events.some((event: AdapterOutputEvent) => (
      event.type === 'error' &&
      event.data.message.includes('invalid_encrypted_content')
    ))).toBe(true)
    expect(events.some((event: AdapterOutputEvent) => (
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
