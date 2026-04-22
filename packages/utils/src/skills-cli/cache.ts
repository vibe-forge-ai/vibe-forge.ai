import type { SkillsCliFindResult, SkillsCliListedSkill } from './types'

const findCache = new Map<string, {
  expiresAt: number
  results: SkillsCliFindResult[]
}>()
const listCache = new Map<string, {
  expiresAt: number
  results: SkillsCliListedSkill[]
}>()

export const FIND_CACHE_TTL_MS = 60 * 1000
export const LIST_CACHE_TTL_MS = 5 * 60 * 1000

export const pruneExpiredCacheEntries = <T>(
  cache: Map<string, {
    expiresAt: number
    results: T
  }>,
  now = Date.now()
) => {
  for (const [cacheKey, entry] of cache.entries()) {
    if (entry.expiresAt <= now) {
      cache.delete(cacheKey)
    }
  }
}

export const getFindCache = () => findCache
export const getListCache = () => listCache

export const clearSkillsCliCachesForTest = () => {
  findCache.clear()
  listCache.clear()
}

export const getSkillsCliCacheSizesForTest = () => ({
  find: findCache.size,
  list: listCache.size
})
