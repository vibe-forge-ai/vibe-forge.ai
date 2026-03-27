import { describe, expect, it } from 'vitest'

import type { ModelMetadataConfig, ModelServiceConfig } from '#~/config/types.js'
import {
  listServiceModels,
  resolveDefaultModelSelection,
  resolveModelDefaultAdapter,
  resolveModelMetadata,
  resolveModelSelection
} from '#~/utils/model-selection.js'

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
})
