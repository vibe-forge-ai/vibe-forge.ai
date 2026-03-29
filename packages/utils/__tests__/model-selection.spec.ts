import { describe, expect, it } from 'vitest'

import type { ModelMetadataConfig, ModelServiceConfig } from '@vibe-forge/types'
import {
  doesModelMatchSelector,
  evaluateAdapterModelRules,
  listServiceModels,
  resolveAdapterConfiguredDefaultModel,
  resolveAdapterModelCompatibility,
  resolveDefaultModelSelection,
  resolveModelDefaultAdapter,
  resolveModelMetadata,
  resolveModelSelection
} from '#~/model-selection.js'

const modelServices: Record<string, ModelServiceConfig> = {
  serviceA: {
    apiBaseUrl: 'https://service-a.example.com',
    apiKey: 'token-a',
    models: ['modelX', 'modelAOnly']
  },
  serviceB: {
    apiBaseUrl: 'https://service-b.example.com',
    apiKey: 'token-b',
    models: ['modelX', 'modelBOnly']
  }
}

describe('model selection utilities', () => {
  it('resolves exact selector metadata before service-level metadata', () => {
    const models: Record<string, ModelMetadataConfig> = {
      serviceA: { defaultAdapter: 'claude-code' },
      'serviceA,modelX': { defaultAdapter: 'codex' }
    }

    expect(resolveModelDefaultAdapter({
      model: 'serviceA,modelX',
      models
    })).toBe('codex')
    expect(resolveModelMetadata({
      model: 'serviceA,modelAOnly',
      models
    })).toEqual({ defaultAdapter: 'claude-code' })
  })

  it('ignores invalid selector keys and falls back to service entries', () => {
    const models: Record<string, ModelMetadataConfig> = {
      modelX: { defaultAdapter: 'codex' },
      serviceB: { defaultAdapter: 'claude-code' }
    }

    expect(resolveModelDefaultAdapter({
      model: 'serviceB,modelX',
      models
    })).toBe('claude-code')
  })

  it('resolves raw models through the preferred default service', () => {
    const serviceModels = listServiceModels(modelServices)

    expect(resolveModelSelection({
      value: 'modelX',
      serviceModels,
      preferredServiceKey: 'serviceB',
      preserveUnknown: false
    })).toBe('serviceB,modelX')
  })

  it('falls back to default service first model when no explicit model is configured', () => {
    const serviceModels = listServiceModels(modelServices)

    expect(resolveDefaultModelSelection({
      defaultModelService: 'serviceB',
      serviceModels,
      preserveUnknownDefaultModel: false
    })).toBe('serviceB,modelX')
  })

  it('matches service selectors and exact selectors for routed models', () => {
    expect(doesModelMatchSelector({
      model: 'serviceA,modelX',
      selector: 'serviceA'
    })).toBe(true)
    expect(doesModelMatchSelector({
      model: 'serviceA,modelX',
      selector: 'serviceA,modelX'
    })).toBe(true)
    expect(doesModelMatchSelector({
      model: 'serviceA,modelX',
      selector: 'serviceB'
    })).toBe(false)
  })

  it('prefers adapter defaultModel before global defaults', () => {
    const serviceModels = listServiceModels(modelServices)

    expect(resolveAdapterConfiguredDefaultModel({
      adapterConfig: {
        defaultModel: 'serviceB,modelBOnly'
      },
      serviceModels,
      preferredServiceKey: 'serviceA',
      preserveUnknown: false
    })).toBe('serviceB,modelBOnly')
  })

  it('treats service selectors as valid includeModels rules', () => {
    expect(evaluateAdapterModelRules({
      model: 'serviceA,modelX',
      adapterConfig: {
        includeModels: ['serviceA']
      }
    })).toMatchObject({
      allowed: true
    })

    expect(evaluateAdapterModelRules({
      model: 'serviceB,modelX',
      adapterConfig: {
        includeModels: ['serviceA']
      }
    })).toMatchObject({
      allowed: false,
      reason: 'not_included'
    })
  })

  it('does not let includeModels reject the literal default model', () => {
    expect(evaluateAdapterModelRules({
      model: 'default',
      adapterConfig: {
        includeModels: ['serviceA']
      }
    })).toMatchObject({
      allowed: true
    })
  })

  it('falls back to adapter defaultModel when the selected model is excluded', () => {
    const serviceModels = listServiceModels(modelServices)

    expect(resolveAdapterModelCompatibility({
      adapter: 'codex',
      model: 'serviceA,modelX',
      adapterConfig: {
        defaultModel: 'serviceB,modelBOnly',
        excludeModels: ['serviceA,modelX']
      },
      serviceModels,
      preferredServiceKey: 'serviceA',
      preserveUnknownDefaultModel: false
    })).toMatchObject({
      model: 'serviceB,modelBOnly',
      warning: {
        adapter: 'codex',
        requestedModel: 'serviceA,modelX',
        resolvedModel: 'serviceB,modelBOnly',
        reason: 'excluded'
      }
    })
  })

  it('returns an error when adapter rules reject the model and no defaultModel exists', () => {
    const serviceModels = listServiceModels(modelServices)

    expect(resolveAdapterModelCompatibility({
      adapter: 'codex',
      model: 'serviceB,modelX',
      adapterConfig: {
        includeModels: ['serviceA']
      },
      serviceModels,
      preferredServiceKey: 'serviceA',
      preserveUnknownDefaultModel: false
    })).toMatchObject({
      error: {
        type: 'missing_default_model',
        adapter: 'codex',
        requestedModel: 'serviceB,modelX',
        reason: 'not_included'
      }
    })
  })
})
