import { describe, expect, it } from 'vitest'

import {
  listServiceModels,
  resolveAdapterForChatModelSelection,
  resolveChatAdapterSelection,
  resolveChatModelSelection,
  resolveDefaultChatModelSelection,
  resolveModelForChatAdapterSelection,
  resolveServiceModelSelector
} from '#~/hooks/chat/model-selector'
import type { AdapterBuiltinModel, ModelMetadataConfig, ModelServiceConfig } from '@vibe-forge/core'

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

const adapterBuiltinModels: Record<string, AdapterBuiltinModel[]> = {
  codex: [
    {
      value: 'builtin-fast',
      title: 'builtin-fast',
      description: 'Fast builtin model'
    }
  ],
  'claude-code': [
    {
      value: 'sonnet',
      title: 'sonnet',
      description: 'Claude Sonnet'
    }
  ]
}

const modelMetadata: Record<string, ModelMetadataConfig> = {
  serviceA: {
    defaultAdapter: 'claude-code'
  },
  'serviceA,modelX': {
    defaultAdapter: 'codex'
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

  it('resolves adapter by exact model selector metadata before service metadata', () => {
    expect(resolveAdapterForChatModelSelection({
      model: 'serviceA,modelX',
      availableAdapters: ['claude-code', 'codex'],
      defaultAdapter: 'claude-code',
      adapterBuiltinModels,
      modelMetadata
    })).toBe('codex')

    expect(resolveAdapterForChatModelSelection({
      model: 'serviceA,modelAOnly',
      availableAdapters: ['claude-code', 'codex'],
      defaultAdapter: 'codex',
      adapterBuiltinModels,
      modelMetadata
    })).toBe('claude-code')
  })

  it('falls back to a builtin-compatible adapter when no routed selector metadata exists', () => {
    expect(resolveAdapterForChatModelSelection({
      model: 'sonnet',
      availableAdapters: ['codex', 'claude-code'],
      defaultAdapter: 'codex',
      adapterBuiltinModels,
      modelMetadata: {}
    })).toBe('claude-code')
  })

  it('uses adapter-level default model before global defaults', () => {
    const serviceModels = listServiceModels(modelServices)

    expect(resolveModelForChatAdapterSelection({
      adapter: 'codex',
      adapters: {
        codex: {
          model: 'serviceB,modelBOnly'
        }
      },
      defaultModel: 'serviceA,modelAOnly',
      defaultModelService: 'serviceA',
      builtinModels: ['builtin-fast'],
      fallbackBuiltinModels: ['builtin-fast', 'sonnet'],
      serviceModels
    })).toBe('serviceB,modelBOnly')
  })

  it('validates adapter selections against the available adapter list', () => {
    expect(resolveChatAdapterSelection({
      value: 'missing',
      availableAdapters: ['codex', 'claude-code'],
      defaultAdapter: 'claude-code'
    })).toBe('claude-code')
  })
})
