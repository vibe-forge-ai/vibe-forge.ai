import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import type { AdapterCtx, AdapterOutputEvent } from '@vibe-forge/types'

import { createGeminiSession } from '#~/runtime/session.js'

const waitFor = async (predicate: () => boolean, timeoutMs = 5_000) => {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for Gemini session events')
    }
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

const createCtx = (cwd: string, env: Record<string, string> = {}) => {
  const cacheStore = new Map<string, unknown>()
  return {
    ctxId: 'ctx-gemini-session-test',
    cwd,
    env,
    cache: {
      get: async (key: string) => cacheStore.get(key),
      set: async (key: string, value: unknown) => {
        cacheStore.set(key, value)
        return { cachePath: join(cwd, '.ai', 'caches', `${key}.json`) }
      }
    },
    logger: {
      stream: undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
      debug: () => undefined
    },
    configs: [{
      adapters: {
        gemini: {}
      }
    }, undefined]
  } satisfies AdapterCtx
}

describe('createGeminiSession', () => {
  let tmpDir: string | undefined

  afterEach(async () => {
    if (tmpDir != null) {
      await rm(tmpDir, { recursive: true, force: true })
      tmpDir = undefined
    }
  })

  it('emits stop and exit events in stream mode', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'vf-gemini-session-'))
    const fakeGeminiPath = join(tmpDir, 'fake-gemini.mjs')

    await writeFile(fakeGeminiPath, [
      `#!${process.execPath}`,
      `console.log(JSON.stringify({ type: 'init', session_id: 'native-session-1' }))`,
      `console.log(JSON.stringify({ type: 'message', role: 'assistant', content: 'KIMI_DIRECT_OK' }))`
    ].join('\n'))
    await chmod(fakeGeminiPath, 0o755)

    const events: AdapterOutputEvent[] = []
    const session = await createGeminiSession(createCtx(tmpDir, {
      __VF_PROJECT_AI_ADAPTER_GEMINI_CLI_PATH__: fakeGeminiPath
    }), {
      type: 'create',
      runtime: 'cli',
      mode: 'stream',
      sessionId: 'session-success',
      description: 'hi',
      onEvent: (event) => {
        events.push(event)
      }
    })

    await waitFor(() => events.some((event) => event.type === 'exit'))
    session.kill()

    expect(events).toEqual([
      expect.objectContaining({ type: 'init' }),
      expect.objectContaining({
        type: 'message',
        data: expect.objectContaining({
          content: 'KIMI_DIRECT_OK'
        })
      }),
      expect.objectContaining({
        type: 'stop',
        data: expect.objectContaining({
          content: 'KIMI_DIRECT_OK'
        })
      }),
      {
        type: 'exit',
        data: {
          exitCode: 0
        }
      }
    ])
  })

  it('starts the native CLI in direct mode and caches the native Gemini session id', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'vf-gemini-direct-'))
    const fakeGeminiPath = join(tmpDir, 'fake-gemini-direct.mjs')
    const nativeSessionId = 'abcd1234-1111-2222-3333-444455556666'

    await writeFile(fakeGeminiPath, [
      `#!${process.execPath}`,
      `import { mkdir, writeFile } from 'node:fs/promises'`,
      `import { join } from 'node:path'`,
      `const args = process.argv.slice(2)`,
      `if (!args.includes('--prompt-interactive')) process.exit(17)`,
      `const chatDir = join(process.env.GEMINI_CLI_HOME, '.gemini', 'tmp', 'test-project', 'chats')`,
      `await mkdir(chatDir, { recursive: true })`,
      `await writeFile(join(chatDir, 'session-2026-04-16T00-00-abcd1234.json'), JSON.stringify({ sessionId: '${nativeSessionId}' }))`
    ].join('\n'))
    await chmod(fakeGeminiPath, 0o755)

    const ctx = createCtx(tmpDir, {
      __VF_PROJECT_AI_ADAPTER_GEMINI_CLI_PATH__: fakeGeminiPath
    })
    const events: AdapterOutputEvent[] = []
    const session = await createGeminiSession(ctx, {
      type: 'create',
      runtime: 'cli',
      mode: 'direct',
      sessionId: 'session-direct',
      description: 'hi',
      onEvent: (event) => {
        events.push(event)
      }
    })

    await waitFor(() => events.some((event) => event.type === 'exit'))
    session.kill()

    expect(events).toEqual([
      expect.objectContaining({ type: 'init' }),
      {
        type: 'exit',
        data: {
          exitCode: 0
        }
      }
    ])
    await expect(ctx.cache.get('adapter.gemini.session')).resolves.toEqual({
      geminiSessionId: nativeSessionId
    })
  })
})
