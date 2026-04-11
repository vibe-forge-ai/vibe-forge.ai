import { describe, expect, it, vi } from 'vitest'

import { createCodexProxyCatalog } from '#~/runtime/proxy-catalog.js'

describe('createCodexProxyCatalog', () => {
  const routes = [
    {
      selectorValue: 'service-a,alpha',
      nativeModelId: 'vf::service-a::alpha',
      title: 'alpha',
      description: 'service alpha',
      order: 0,
      kind: 'service' as const,
      serviceKey: 'service-a',
      upstreamModel: 'alpha',
      upstreamBaseUrl: 'https://example.test'
    },
    {
      selectorValue: 'gpt-5.4',
      nativeModelId: 'gpt-5.4',
      title: 'gpt-5.4',
      description: 'builtin',
      order: 1,
      kind: 'builtin_passthrough' as const,
      upstreamModel: 'gpt-5.4-2026-03-05',
      upstreamBaseUrl: 'https://api.openai.com'
    }
  ]

  it('resolves routes by native id, selector, and upstream model without changing selector semantics', () => {
    const onSelectorChange = vi.fn()
    const catalog = createCodexProxyCatalog({
      routes,
      initialNativeModelId: 'service-a,alpha',
      onSelectorChange
    })

    expect(catalog.currentNativeModelId).toBe('vf::service-a::alpha')
    expect(catalog.resolve('vf::service-a::alpha')?.selectorValue).toBe('service-a,alpha')
    expect(catalog.resolve('service-a,alpha')?.nativeModelId).toBe('vf::service-a::alpha')
    expect(catalog.resolve('alpha')?.nativeModelId).toBe('vf::service-a::alpha')

    catalog.setCurrentModel('alpha')

    expect(catalog.currentNativeModelId).toBe('vf::service-a::alpha')
    expect(onSelectorChange).not.toHaveBeenCalled()

    catalog.setCurrentModel('gpt-5.4-2026-03-05')

    expect(catalog.currentNativeModelId).toBe('gpt-5.4')
    expect(onSelectorChange).toHaveBeenCalledWith('gpt-5.4')
  })
})
