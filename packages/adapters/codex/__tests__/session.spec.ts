import { execFileSync } from 'node:child_process'
import { chmod, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { AdapterOutputEvent } from '@vibe-forge/types'
import { resolveManagedNpmCliPaths } from '@vibe-forge/utils/managed-npm-cli'

import { CODEX_CLI_PACKAGE, CODEX_CLI_VERSION, resolveCodexBinaryPath } from '#~/paths.js'
import { createCodexSession } from '#~/runtime/session.js'

// ─── Availability check ───────────────────────────────────────────────────────

const codexAvailable = (() => {
  try {
    execFileSync('codex', ['--version'], { stdio: 'ignore', timeout: 5000 })
    return true
  } catch {
    return false
  }
})()

// ─── Path utilities ───────────────────────────────────────────────────────────

describe('resolveCodexBinaryPath', () => {
  const expectDefaultCodexBinary = (result: string) => {
    expect(result === 'codex' || /node_modules\/\.bin\/codex$/.test(result)).toBe(true)
  }

  it('resolves to a usable default binary without requiring a bundled dependency', () => {
    const result = resolveCodexBinaryPath({})
    expectDefaultCodexBinary(result)
  })

  it('returns the env-specified path when set', () => {
    expect(resolveCodexBinaryPath({
      __VF_PROJECT_AI_ADAPTER_CODEX_CLI_PATH__: '/usr/local/bin/codex'
    })).toBe('/usr/local/bin/codex')
  })

  it('falls back to the default binary when env value is empty string', () => {
    const result = resolveCodexBinaryPath({
      __VF_PROJECT_AI_ADAPTER_CODEX_CLI_PATH__: ''
    })
    expectDefaultCodexBinary(result)
  })

  it('uses a managed binary from the primary workspace shared cache', async () => {
    const primary = await mkdtemp(join(tmpdir(), 'vf-codex-primary-'))
    const worktree = await mkdtemp(join(tmpdir(), 'vf-codex-worktree-'))
    try {
      const env = {
        __VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__: primary
      }
      const paths = resolveManagedNpmCliPaths({
        adapterKey: 'codex',
        binaryName: 'codex',
        cwd: worktree,
        env,
        packageName: CODEX_CLI_PACKAGE,
        version: CODEX_CLI_VERSION
      })
      await mkdir(paths.binDir, { recursive: true })
      await writeFile(paths.binaryPath, '#!/bin/sh\n')
      await chmod(paths.binaryPath, 0o755)

      expect(resolveCodexBinaryPath(env, worktree)).toBe(await realpath(paths.binaryPath))
    } finally {
      await rm(primary, { recursive: true, force: true })
      await rm(worktree, { recursive: true, force: true })
    }
  })
})

// ─── Integration tests (require real codex binary) ────────────────────────────

describe.skipIf(!codexAvailable)('codex app-server integration', () => {
  let tmpDir: string
  let mockHome: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'vibe-codex-test-'))
    mockHome = join(tmpDir, '.ai', '.mock')
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  function makeCtx(env: Record<string, string> = {}) {
    const mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {}
    }
    const cacheStore = new Map<string, unknown>()
    return {
      ctxId: 'test-ctx',
      cwd: tmpDir,
      env: {
        ...env
      },
      cache: {
        set: async (key: string, value: unknown) => {
          cacheStore.set(key, value)
          return { cachePath: join(tmpDir, `${key}.json`) }
        },
        get: async (key: string) => cacheStore.get(key)
      },
      logger: mockLogger,
      configs: [undefined, undefined]
    } as any
  }

  function getCachedThreadIds(value: unknown) {
    return Object.values((value ?? {}) as Record<string, unknown>)
      .filter((item): item is string => typeof item === 'string')
  }

  it('completes the initialize handshake and receives a thread id', async () => {
    const events: AdapterOutputEvent[] = []
    const ctx = makeCtx()

    const session = await createCodexSession(ctx, {
      type: 'create',
      runtime: 'server',
      sessionId: 'test-session-1',
      onEvent: (e: AdapterOutputEvent) => events.push(e)
    })

    // Give the server a moment to emit turn/completed
    await new Promise(r => setTimeout(r, 1000))

    session.kill()

    // Session should not have thrown; cache should have a thread id
    const cachedThreads = await ctx.cache.get('adapter.codex.threads')
    const cachedThreadIds = getCachedThreadIds(cachedThreads)
    expect(cachedThreadIds.length).toBeGreaterThan(0)
    expect(typeof cachedThreadIds[0]).toBe('string')
  }, 15_000)

  it('sends a turn and receives agent message and stop events', async () => {
    const events: AdapterOutputEvent[] = []
    const ctx = makeCtx()

    const session = await createCodexSession(ctx, {
      type: 'create',
      runtime: 'server',
      sessionId: 'test-session-2',
      description: 'Reply with the single word "pong" and nothing else.',
      onEvent: (e: AdapterOutputEvent) => events.push(e)
    })

    // Wait up to 30 s for the turn to complete
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => resolve(), 30_000)
      const orig = session.kill
      session.kill = () => {
        clearTimeout(timeout)
        orig()
      }
      const check = () => {
        const stopped = events.some(e => e.type === 'stop')
        if (stopped) {
          clearTimeout(timeout)
          resolve()
        }
      }
      // Poll for stop event
      const interval = setInterval(() => {
        check()
        if (events.some(e => e.type === 'stop')) clearInterval(interval)
      }, 200)
    })

    session.kill()

    const messageEvents = events.filter(e => e.type === 'message')
    const stopEvents = events.filter(e => e.type === 'stop')

    expect(stopEvents.length).toBeGreaterThan(0)
    expect(messageEvents.length).toBeGreaterThan(0)
  }, 35_000)

  it('resumes an existing thread via thread/resume', async () => {
    // Create a thread first
    const eventsA: AdapterOutputEvent[] = []
    const ctx = makeCtx()

    const sessionA = await createCodexSession(ctx, {
      type: 'create',
      runtime: 'server',
      sessionId: 'test-session-resume',
      description: 'Say "hello".',
      onEvent: (e: AdapterOutputEvent) => eventsA.push(e)
    })

    // Wait for stop
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (eventsA.some(e => e.type === 'stop')) {
          clearInterval(interval)
          resolve()
        }
      }, 200)
      setTimeout(resolve, 30_000)
    })
    sessionA.kill()

    const threadIdAfterCreate = getCachedThreadIds(await ctx.cache.get('adapter.codex.threads'))[0]
    expect(threadIdAfterCreate).toBeDefined()

    // Now resume the same session
    const eventsB: AdapterOutputEvent[] = []
    const sessionB = await createCodexSession(ctx, {
      type: 'resume',
      runtime: 'server',
      sessionId: 'test-session-resume',
      description: 'Say "world".',
      onEvent: (e: AdapterOutputEvent) => eventsB.push(e)
    })

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (eventsB.some(e => e.type === 'stop')) {
          clearInterval(interval)
          resolve()
        }
      }, 200)
      setTimeout(resolve, 30_000)
    })
    sessionB.kill()

    // Thread id should be the same (resumed not created)
    const threadIdAfterResume = getCachedThreadIds(await ctx.cache.get('adapter.codex.threads'))[0]
    expect(threadIdAfterResume).toBe(threadIdAfterCreate)
  }, 70_000)
})
