import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import '../../adapters/claude-code/src/adapter-config.js'
import '../../adapters/codex/src/adapter-config.js'
import '../../adapters/copilot/src/adapter-config.js'
import '../../adapters/gemini/src/adapter-config.js'
import '../../adapters/opencode/src/adapter-config.js'
import { getCache, getCachePath, getCacheWithLegacyFallback, setCache } from '#~/cache.js'

const adapterResumeFixtures = [
  {
    key: 'adapter.codex.threads',
    value: { 'context:codex': 'thr_legacy' },
    otherKey: 'adapter.gemini.session',
    otherValue: { geminiSessionId: 'gemini-native' }
  },
  {
    key: 'adapter.claude-code.resume-state',
    value: { canResume: true },
    otherKey: 'adapter.codex.threads',
    otherValue: { 'context:codex': 'thr_other_adapter' }
  },
  {
    key: 'adapter.copilot.session',
    value: { copilotSessionId: 'copilot-native' },
    otherKey: 'adapter.claude-code.resume-state',
    otherValue: { canResume: true }
  },
  {
    key: 'adapter.gemini.session',
    value: { geminiSessionId: 'gemini-native' },
    otherKey: 'adapter.copilot.session',
    otherValue: { copilotSessionId: 'copilot-native' }
  },
  {
    key: 'adapter.opencode.session',
    value: { opencodeSessionId: 'opencode-native', title: 'Vibe Forge:session-1' },
    otherKey: 'adapter.gemini.session',
    otherValue: { geminiSessionId: 'gemini-other' }
  }
] as const

describe('cache utils', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
  })

  it('returns undefined when the cache file does not exist', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'vf-cache-'))
    tempDirs.push(cwd)

    const result = await getCache(cwd, 'task-1', 'session-1', 'adapter.codex.threads')

    expect(result).toBeUndefined()
  })

  it('writes and reads cache values for a session-scoped key', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'vf-cache-'))
    tempDirs.push(cwd)

    const expectedValue = { sessionA: 'thr_123' }
    const writeResult = await setCache(cwd, 'task-1', 'session-1', 'adapter.codex.threads', expectedValue)
    const readResult = await getCache(cwd, 'task-1', 'session-1', 'adapter.codex.threads')

    expect(writeResult.cachePath).toBe(getCachePath(cwd, 'task-1', 'session-1', 'adapter.codex.threads'))
    expect(readResult).toEqual(expectedValue)
  })

  it('treats invalid cache json as a cache miss without deleting the file', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'vf-cache-'))
    tempDirs.push(cwd)

    const cachePath = getCachePath(cwd, 'task-1', 'session-1', 'adapter.codex.threads')
    await mkdir(dirname(cachePath), { recursive: true })
    await writeFile(cachePath, '{"broken":', 'utf8')

    const result = await getCache(cwd, 'task-1', 'session-1', 'adapter.codex.threads')

    expect(result).toBeUndefined()
    await expect(writeFile(cachePath, '{"fixed": true}', 'utf8')).resolves.toBeUndefined()
    await expect(getCache(cwd, 'task-1', 'session-1', 'adapter.codex.threads')).resolves.toEqual({
      fixed: true
    })
  })

  it('uses unique temp paths for concurrent writes in the same millisecond', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'vf-cache-'))
    tempDirs.push(cwd)

    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1700000000000)

    try {
      await Promise.all([
        setCache(cwd, 'task-1', 'session-1', 'adapter.codex.threads', { sessionA: 'thr_1' }),
        setCache(cwd, 'task-1', 'session-1', 'adapter.codex.threads', { sessionA: 'thr_2' })
      ])
    } finally {
      nowSpy.mockRestore()
    }

    await expect(getCache(cwd, 'task-1', 'session-1', 'adapter.codex.threads')).resolves.toEqual(
      expect.objectContaining({
        sessionA: expect.stringMatching(/^thr_[12]$/)
      })
    )
  })

  it.each(adapterResumeFixtures)(
    'restores $key from a legacy context for the same session and key',
    async ({ key, value }) => {
      const cwd = await mkdtemp(join(tmpdir(), 'vf-cache-'))
      tempDirs.push(cwd)

      await setCache(cwd, 'legacy-ctx', 'session-1', key, value)

      const result = await getCacheWithLegacyFallback(cwd, 'session-1', 'session-1', key)

      expect(result).toEqual(value)
      await expect(getCache(cwd, 'session-1', 'session-1', key)).resolves.toEqual(value)
    }
  )

  it.each(adapterResumeFixtures)(
    'does not restore $key from another adapter key or another session',
    async ({ key, otherKey, otherValue }) => {
      const cwd = await mkdtemp(join(tmpdir(), 'vf-cache-'))
      tempDirs.push(cwd)

      await setCache(cwd, 'legacy-ctx', 'session-1', otherKey, otherValue)
      await setCache(cwd, 'legacy-ctx', 'session-2', key, otherValue as never)

      const result = await getCacheWithLegacyFallback(cwd, 'session-1', 'session-1', key)

      expect(result).toBeUndefined()
      await expect(getCache(cwd, 'session-1', 'session-1', key)).resolves.toBeUndefined()
    }
  )
})
