import { describe, expect, it } from 'vitest'

import {
  resolveBuiltinPassthroughRoutes,
  resolveNativeIdToSelector,
  resolveServiceRoutes
} from '#~/native-model-catalog-internal.js'
import { buildNativeModelCatalog } from '#~/native-model-catalog.js'
import type { ModelServiceConfig, NativeModelRouteDescriptor } from '@vibe-forge/types'

const modelServices: Record<string, ModelServiceConfig> = {
  openrouter: {
    apiBaseUrl: 'https://openrouter.ai/api/v1',
    apiKey: 'token-or',
    models: ['gpt-5.4', 'claude-sonnet-4']
  },
  custom: {
    apiBaseUrl: 'https://custom.example.com',
    apiKey: 'token-custom',
    models: ['my-model']
  }
}

const builtinModels = [
  { value: 'sonnet', title: 'Claude Sonnet', description: 'Fast model' },
  { value: 'opus', title: 'Claude Opus', description: 'Powerful model' },
  { value: 'haiku', title: 'Claude Haiku', description: 'Lightweight model' }
]

const resolveUpstream = (builtinValue: string) => {
  if (builtinValue === 'haiku') return undefined
  return {
    upstreamBaseUrl: 'https://api.anthropic.com',
    upstreamModel: builtinValue,
    headers: { 'x-api-key': 'test-key' }
  }
}

describe('resolveBuiltinPassthroughRoutes', () => {
  it('builds routes for reachable builtins and omits unreachable ones', () => {
    const routes = resolveBuiltinPassthroughRoutes({
      builtinModels,
      resolveUpstream,
      baseOrder: 0
    })

    expect(routes).toHaveLength(2)
    expect(routes[0].selectorValue).toBe('sonnet')
    expect(routes[0].kind).toBe('builtin_passthrough')
    expect(routes[0].upstreamBaseUrl).toBe('https://api.anthropic.com')
    expect(routes[0].order).toBe(0)
    expect(routes[1].selectorValue).toBe('opus')
    expect(routes[1].order).toBe(1)
  })

  it('returns empty array when no builtins are reachable', () => {
    const routes = resolveBuiltinPassthroughRoutes({
      builtinModels,
      resolveUpstream: () => undefined,
      baseOrder: 0
    })
    expect(routes).toEqual([])
  })

  it('uses display metadata from models config when available', () => {
    const routes = resolveBuiltinPassthroughRoutes({
      builtinModels,
      resolveUpstream,
      models: {
        sonnet: { title: 'Overridden Title', description: 'Overridden Desc' }
      },
      baseOrder: 0
    })

    expect(routes[0].title).toBe('Overridden Title')
    expect(routes[0].description).toBe('Overridden Desc')
  })
})

describe('resolveServiceRoutes', () => {
  it('builds service routes with selector native IDs', () => {
    const routes = resolveServiceRoutes({
      modelServices,
      nativeIdStrategy: 'selector',
      baseOrder: 100
    })

    expect(routes).toHaveLength(3)
    expect(routes[0].selectorValue).toBe('openrouter,gpt-5.4')
    expect(routes[0].nativeModelId).toBe('openrouter,gpt-5.4')
    expect(routes[0].kind).toBe('service')
    expect(routes[0].serviceKey).toBe('openrouter')
    expect(routes[0].order).toBe(100)
  })

  it('builds service routes with vf-prefixed native IDs', () => {
    const routes = resolveServiceRoutes({
      modelServices,
      nativeIdStrategy: 'vf_prefixed',
      baseOrder: 100
    })

    expect(routes[0].nativeModelId).toBe('vf::openrouter::gpt-5.4')
    expect(routes[0].selectorValue).toBe('openrouter,gpt-5.4')
  })

  it('skips services with empty apiBaseUrl', () => {
    const routes = resolveServiceRoutes({
      modelServices: {
        empty: { apiBaseUrl: '', apiKey: 'tok', models: ['m1'] }
      },
      nativeIdStrategy: 'selector',
      baseOrder: 0
    })
    expect(routes).toEqual([])
  })

  it('includes maxOutputTokens from service config', () => {
    const routes = resolveServiceRoutes({
      modelServices: {
        svc: {
          apiBaseUrl: 'https://example.com',
          apiKey: 'tok',
          models: ['m1'],
          maxOutputTokens: 4096
        }
      },
      nativeIdStrategy: 'selector',
      baseOrder: 0
    })
    expect(routes[0].maxOutputTokens).toBe(4096)
  })

  it('applies headers and queryParams from resolveServiceMeta callback', () => {
    const routes = resolveServiceRoutes({
      modelServices,
      nativeIdStrategy: 'selector',
      baseOrder: 0,
      resolveServiceMeta: (serviceKey, service) => ({
        headers: { Authorization: `Bearer ${service.apiKey}` },
        queryParams: { 'api-version': '2024-01-01' }
      })
    })

    expect(routes[0].headers).toEqual({ Authorization: 'Bearer token-or' })
    expect(routes[0].queryParams).toEqual({ 'api-version': '2024-01-01' })
  })

  it('applies upstreamBaseUrl override from resolveServiceMeta callback', () => {
    const routes = resolveServiceRoutes({
      modelServices,
      nativeIdStrategy: 'selector',
      baseOrder: 0,
      resolveServiceMeta: () => ({
        upstreamBaseUrl: 'https://normalized.example.com/v1'
      })
    })

    expect(routes[0].upstreamBaseUrl).toBe('https://normalized.example.com/v1')
  })

  it('falls back to service.apiBaseUrl when resolveServiceMeta returns undefined', () => {
    const routes = resolveServiceRoutes({
      modelServices,
      nativeIdStrategy: 'selector',
      baseOrder: 0,
      resolveServiceMeta: () => undefined
    })

    expect(routes[0].upstreamBaseUrl).toBe('https://openrouter.ai/api/v1')
    expect(routes[0].headers).toBeUndefined()
    expect(routes[0].queryParams).toBeUndefined()
  })
})

describe('resolveNativeIdToSelector', () => {
  const catalog: NativeModelRouteDescriptor[] = [
    {
      selectorValue: 'sonnet',
      nativeModelId: 'sonnet',
      title: 'Sonnet',
      order: 0,
      kind: 'builtin_passthrough',
      upstreamModel: 'sonnet',
      upstreamBaseUrl: 'https://api.anthropic.com'
    },
    {
      selectorValue: 'openrouter,gpt-5.4',
      nativeModelId: 'vf::openrouter::gpt-5.4',
      title: 'GPT 5.4',
      order: 1,
      kind: 'service',
      serviceKey: 'openrouter',
      upstreamModel: 'gpt-5.4',
      upstreamBaseUrl: 'https://openrouter.ai/api/v1'
    }
  ]

  it('resolves builtin native ID to selector', () => {
    expect(resolveNativeIdToSelector('sonnet', catalog)).toBe('sonnet')
  })

  it('resolves vf-prefixed native ID to selector', () => {
    expect(resolveNativeIdToSelector('vf::openrouter::gpt-5.4', catalog)).toBe('openrouter,gpt-5.4')
  })

  it('returns undefined for unknown native ID', () => {
    expect(resolveNativeIdToSelector('unknown', catalog)).toBeUndefined()
  })
})

describe('buildNativeModelCatalog', () => {
  it('combines and sorts routes by order', () => {
    const builtinRoutes = resolveBuiltinPassthroughRoutes({
      builtinModels,
      resolveUpstream,
      baseOrder: 0
    })
    const serviceRoutes = resolveServiceRoutes({
      modelServices,
      nativeIdStrategy: 'selector',
      baseOrder: 100
    })

    const catalog = buildNativeModelCatalog({ builtinRoutes, serviceRoutes })

    expect(catalog.routes).toHaveLength(5)
    expect(catalog.routes[0].kind).toBe('builtin_passthrough')
    expect(catalog.routes[0].order).toBe(0)
    expect(catalog.routes[2].kind).toBe('service')
    expect(catalog.routes[2].order).toBe(100)
  })

  it('resolves default route from defaultSelector', () => {
    const builtinRoutes = resolveBuiltinPassthroughRoutes({
      builtinModels,
      resolveUpstream,
      baseOrder: 0
    })

    const catalog = buildNativeModelCatalog({
      builtinRoutes,
      serviceRoutes: [],
      defaultSelector: 'opus'
    })

    expect(catalog.defaultRoute?.selectorValue).toBe('opus')
  })

  it('falls back to first route as default when no defaultSelector', () => {
    const builtinRoutes = resolveBuiltinPassthroughRoutes({
      builtinModels,
      resolveUpstream,
      baseOrder: 0
    })

    const catalog = buildNativeModelCatalog({ builtinRoutes, serviceRoutes: [] })

    expect(catalog.defaultRoute?.selectorValue).toBe('sonnet')
  })

  it('falls back to first route when defaultSelector does not match any route', () => {
    const builtinRoutes = resolveBuiltinPassthroughRoutes({
      builtinModels,
      resolveUpstream,
      baseOrder: 0
    })

    const catalog = buildNativeModelCatalog({
      builtinRoutes,
      serviceRoutes: [],
      defaultSelector: 'nonexistent-model'
    })

    expect(catalog.defaultRoute?.selectorValue).toBe('sonnet')
  })

  it('resolveSelector maps native IDs back to selectors', () => {
    const serviceRoutes = resolveServiceRoutes({
      modelServices,
      nativeIdStrategy: 'vf_prefixed',
      baseOrder: 0
    })

    const catalog = buildNativeModelCatalog({ builtinRoutes: [], serviceRoutes })

    expect(catalog.resolveSelector('vf::openrouter::gpt-5.4')).toBe('openrouter,gpt-5.4')
    expect(catalog.resolveSelector('unknown')).toBeUndefined()
  })
})
