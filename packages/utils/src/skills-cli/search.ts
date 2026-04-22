import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { SkillsCliConfig } from '@vibe-forge/types'

import { FIND_CACHE_TTL_MS, LIST_CACHE_TTL_MS, getFindCache, getListCache, pruneExpiredCacheEntries } from './cache'
import { parseSkillsCliFindOutput, parseSkillsCliListOutput } from './parse'
import { runSkillsCli } from './runtime'
import { normalizeNonEmptyString, toCacheKey, toSkillsCliError } from './shared'

export const listSkillsCliSource = async (params: {
  config?: SkillsCliConfig
  registry?: string
  source: string
}) => {
  const source = normalizeNonEmptyString(params.source)
  if (source == null) {
    throw new Error('skills CLI source is required.')
  }

  const cacheKey = toCacheKey({
    config: params.config,
    input: `list:${source}`,
    registry: params.registry
  })
  const listCache = getListCache()
  pruneExpiredCacheEntries(listCache)
  const cached = listCache.get(cacheKey)
  if (cached != null && cached.expiresAt > Date.now()) {
    return cached.results
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'vf-skills-cli-list-'))
  try {
    const { stdout, stderr } = await runSkillsCli({
      cwd: tempDir,
      config: params.config,
      registry: params.registry,
      args: ['add', source, '--list', '-y']
    })
    const results = parseSkillsCliListOutput(`${stdout}\n${stderr}`)

    if (results.length === 0) {
      throw new Error('skills CLI did not return any discoverable skills for this source.')
    }

    listCache.set(cacheKey, {
      expiresAt: Date.now() + LIST_CACHE_TTL_MS,
      results
    })

    return results
  } catch (error) {
    throw toSkillsCliError(error)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

export const findSkillsCli = async (params: {
  config?: SkillsCliConfig
  query: string
  registry?: string
}) => {
  const query = normalizeNonEmptyString(params.query)
  if (query == null) return []

  const cacheKey = toCacheKey({
    config: params.config,
    input: `find:${query}`,
    registry: params.registry
  })
  const findCache = getFindCache()
  pruneExpiredCacheEntries(findCache)
  const cached = findCache.get(cacheKey)
  if (cached != null && cached.expiresAt > Date.now()) {
    return cached.results
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'vf-skills-cli-find-'))
  try {
    const { stdout, stderr } = await runSkillsCli({
      cwd: tempDir,
      config: params.config,
      registry: params.registry,
      args: ['find', query]
    })
    const results = parseSkillsCliFindOutput(`${stdout}\n${stderr}`)
    findCache.set(cacheKey, {
      expiresAt: Date.now() + FIND_CACHE_TTL_MS,
      results
    })
    return results
  } catch (error) {
    throw toSkillsCliError(error)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}
