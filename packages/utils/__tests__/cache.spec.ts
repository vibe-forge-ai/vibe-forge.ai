import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import '../../adapters/codex/src/adapter-config.js'
import { getCache, getCachePath, setCache } from '#~/cache.js'

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

  it('treats invalid cache json as a cache miss and removes the corrupt file', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'vf-cache-'))
    tempDirs.push(cwd)

    const cachePath = getCachePath(cwd, 'task-1', 'session-1', 'adapter.codex.threads')
    await mkdir(dirname(cachePath), { recursive: true })
    await writeFile(cachePath, '{"broken":', 'utf8')

    const result = await getCache(cwd, 'task-1', 'session-1', 'adapter.codex.threads')

    expect(result).toBeUndefined()
    await expect(getCache(cwd, 'task-1', 'session-1', 'adapter.codex.threads')).resolves.toBeUndefined()
  })
})
