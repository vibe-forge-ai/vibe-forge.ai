import type { ScopedMutator } from 'swr'

const isAdapterConfigCacheKey = (key: unknown) => {
  if (Array.isArray(key)) {
    return key[0] === '/api/adapters'
  }

  return typeof key === 'string' && key.startsWith('/api/adapters/')
}

export const isConfigRelatedDerivedCacheKey = (key: unknown) => {
  if (Array.isArray(key)) {
    return key[0] === 'worktree-environment' || key[0] === '/api/adapters'
  }

  return isAdapterConfigCacheKey(key)
}

export async function revalidateConfigRelatedCaches(mutate: ScopedMutator) {
  await Promise.all([
    mutate('/api/config'),
    mutate('worktree-environments'),
    mutate(isConfigRelatedDerivedCacheKey)
  ])
}
