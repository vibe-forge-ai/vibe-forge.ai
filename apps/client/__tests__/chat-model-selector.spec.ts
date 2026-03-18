import { describe, expect, it } from 'vitest'

import type { ModelServiceConfig } from '@vibe-forge/core'
import {
  listServiceModels,
  resolveChatModelSelection,
  resolveDefaultChatModelSelection,
  resolveServiceModelSelector
} from '#~/hooks/chat/model-selector'

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

describe('chat model selector helpers', () => {
  it('keeps duplicate model names unique by selector value', () => {
    const serviceModels = listServiceModels(modelServices)
    const selectors = serviceModels
      .filter(entry => entry.model === 'modelX')
      .map(entry => entry.selectorValue)

    expect(selectors).toEqual(['serviceA,modelX', 'serviceB,modelX'])
    expect(new Set(selectors).size).toBe(2)
  })

  it('honors a configured default model that is already service-qualified', () => {
    const serviceModels = listServiceModels(modelServices)

    expect(resolveDefaultChatModelSelection({
      defaultModel: 'serviceA,modelX',
      defaultModelService: 'serviceB',
      serviceModels
    })).toBe('serviceA,modelX')
  })

  it('resolves a raw default model through the configured default service first', () => {
    const serviceModels = listServiceModels(modelServices)

    expect(resolveDefaultChatModelSelection({
      defaultModel: 'modelX',
      defaultModelService: 'serviceB',
      serviceModels
    })).toBe('serviceB,modelX')
  })

  it('upgrades legacy raw persisted values to the canonical selector', () => {
    const serviceModels = listServiceModels(modelServices)

    expect(resolveChatModelSelection({
      value: 'modelX',
      defaultModelService: 'serviceB',
      serviceModels
    })).toBe('serviceB,modelX')
  })

  it('keeps builtin adapter models unprefixed', () => {
    const serviceModels = listServiceModels(modelServices)

    expect(resolveChatModelSelection({
      value: 'builtin-fast',
      builtinModels: ['builtin-fast'],
      defaultModelService: 'serviceA',
      serviceModels
    })).toBe('builtin-fast')
  })

  it('routes duplicate-name models through the selected service when already canonical', () => {
    const serviceModels = listServiceModels(modelServices)

    expect(resolveChatModelSelection({
      value: 'serviceB,modelX',
      defaultModelService: 'serviceA',
      serviceModels
    })).toBe('serviceB,modelX')
  })

  it('uses the default service first model before builtin fallback when only defaultModelService is configured', () => {
    const serviceModels = listServiceModels(modelServices)

    expect(resolveDefaultChatModelSelection({
      defaultModelService: 'serviceB',
      builtinModels: ['builtin-fast'],
      serviceModels
    })).toBe('serviceB,modelX')
  })

  it('falls back to the first matching service when no default service is provided', () => {
    const serviceModels = listServiceModels(modelServices)

    expect(resolveServiceModelSelector({
      value: 'modelX',
      serviceModels
    })).toBe('serviceA,modelX')
  })
})
