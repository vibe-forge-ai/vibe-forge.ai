import { describe, expect, it, vi } from 'vitest'

import { isConfigRelatedDerivedCacheKey, revalidateConfigRelatedCaches } from '#~/hooks/session-subscription-cache'

describe('session subscription config cache helpers', () => {
  it('matches adapter and worktree-environment caches that depend on config', () => {
    expect(isConfigRelatedDerivedCacheKey('worktree-environments')).toBe(false)
    expect(isConfigRelatedDerivedCacheKey(['worktree-environment', 'user', 'demo'])).toBe(true)
    expect(isConfigRelatedDerivedCacheKey(['/api/adapters', 'codex', 'gpt-5.4'])).toBe(true)
    expect(isConfigRelatedDerivedCacheKey('/api/adapters/codex/accounts')).toBe(true)
    expect(isConfigRelatedDerivedCacheKey('/api/sessions')).toBe(false)
  })

  it('revalidates config and derived caches after a config update event', async () => {
    const mutate = vi.fn().mockResolvedValue(undefined)

    await revalidateConfigRelatedCaches(mutate)

    expect(mutate).toHaveBeenCalledTimes(3)
    expect(mutate).toHaveBeenNthCalledWith(1, '/api/config')
    expect(mutate).toHaveBeenNthCalledWith(2, 'worktree-environments')
    expect(typeof mutate.mock.calls[2]?.[0]).toBe('function')
  })
})
