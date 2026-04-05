import { describe, expect, it } from 'vitest'

import type {
  AdapterBuiltinModel,
  ModelMetadataConfig,
  ModelServiceConfig,
  RecommendedModelConfig
} from '@vibe-forge/types'

import type { ServiceModelEntry } from '#~/hooks/chat/model-selector'
import { buildModelSelectorData } from '#~/hooks/chat/model-selector-data'

describe('buildModelSelectorData', () => {
  it('keeps recommended models at the first level and groups more models by provider', () => {
    const activeBuiltinModels: Record<string, AdapterBuiltinModel[]> = {
      codex: [
        {
          value: 'codex-mini',
          title: 'Codex Mini',
          description: 'Built-in codex model'
        }
      ]
    }
    const availableServiceModels: ServiceModelEntry[] = [
      {
        serviceKey: 'openai',
        model: 'gpt-5.4-2026-03-05',
        selectorValue: 'openai,gpt-5.4-2026-03-05'
      },
      {
        serviceKey: 'anthropic',
        model: 'claude-sonnet-4-6',
        selectorValue: 'anthropic,claude-sonnet-4-6'
      }
    ]
    const mergedModelServices: Record<string, ModelServiceConfig> = {
      openai: {
        title: 'OpenAI',
        description: 'General models',
        models: ['gpt-5.4-2026-03-05']
      },
      anthropic: {
        title: 'Anthropic',
        models: ['claude-sonnet-4-6']
      }
    }
    const mergedModels: Record<string, ModelMetadataConfig> = {
      'openai,gpt-5.4-2026-03-05': {
        title: 'GPT-5.4 Turbo',
        description: 'Metadata description'
      }
    }
    const recommendedModels: RecommendedModelConfig[] = [
      {
        service: 'openai',
        model: 'gpt-5.4-2026-03-05',
        title: 'GPT-5.4'
      }
    ]

    const result = buildModelSelectorData({
      activeBuiltinModels,
      availableServiceModels,
      defaultModelService: 'openai',
      mergedModels,
      mergedModelServices,
      recommendedModels,
      recommendedGroupTitle: 'Recommended Models',
      servicePreviewGroupTitle: 'Model Services',
      builtinGroupTitle: (adapter) => `${adapter} built-in models`
    })

    expect(result.recommendedOptions.map(option => option.title)).toEqual(['GPT-5.4'])
    expect(result.servicePreviewOptions.map(option => option.value)).toEqual([
      'openai,gpt-5.4-2026-03-05',
      'anthropic,claude-sonnet-4-6'
    ])
    expect(result.recommendedOptions[0]?.serviceTitle).toBe('OpenAI')
    expect(result.moreModelGroups.map(group => group.key)).toEqual([
      'builtin:codex',
      'service:openai',
      'service:anthropic'
    ])
    expect(result.moreModelGroups[1]?.options[0]).toMatchObject({
      title: 'GPT-5.4 Turbo',
      description: 'Metadata description'
    })
    expect(result.moreModelGroups[1]?.options.map(option => option.value)).toEqual(['openai,gpt-5.4-2026-03-05'])
  })

  it('deduplicates search results by model value while preserving recommended ordering', () => {
    const result = buildModelSelectorData({
      activeBuiltinModels: {},
      availableServiceModels: [
        {
          serviceKey: 'openai',
          model: 'gpt-5.4-2026-03-05',
          selectorValue: 'openai,gpt-5.4-2026-03-05'
        }
      ],
      defaultModelService: 'openai',
      mergedModels: {},
      mergedModelServices: {
        openai: {
          title: 'OpenAI',
          models: ['gpt-5.4-2026-03-05']
        }
      },
      recommendedModels: [
        {
          service: 'openai',
          model: 'gpt-5.4-2026-03-05',
          title: 'GPT-5.4'
        }
      ],
      recommendedGroupTitle: 'Recommended Models',
      servicePreviewGroupTitle: 'Model Services',
      builtinGroupTitle: (adapter) => `${adapter} built-in models`
    })

    expect(result.searchOptions).toHaveLength(1)
    expect(result.searchOptions[0]).toMatchObject({
      value: 'openai,gpt-5.4-2026-03-05',
      title: 'GPT-5.4'
    })
  })

  it('falls back to the first model from each service when no recommended models are configured', () => {
    const result = buildModelSelectorData({
      activeBuiltinModels: {},
      availableServiceModels: [
        {
          serviceKey: 'openai',
          model: 'gpt-5.4-2026-03-05',
          selectorValue: 'openai,gpt-5.4-2026-03-05'
        },
        {
          serviceKey: 'openai',
          model: 'gpt-5.4-mini',
          selectorValue: 'openai,gpt-5.4-mini'
        },
        {
          serviceKey: 'anthropic',
          model: 'claude-sonnet-4-6',
          selectorValue: 'anthropic,claude-sonnet-4-6'
        }
      ],
      defaultModelService: 'openai',
      mergedModels: {
        'openai,gpt-5.4-2026-03-05': {
          alias: ['GPT-5.4'],
          description: 'Latest flagship'
        }
      },
      mergedModelServices: {
        openai: {
          title: 'OpenAI',
          description: 'General models',
          models: ['gpt-5.4-2026-03-05', 'gpt-5.4-mini']
        },
        anthropic: {
          title: 'Anthropic',
          description: 'Reasoning models',
          models: ['claude-sonnet-4-6']
        }
      },
      recommendedModels: [],
      recommendedGroupTitle: 'Recommended Models',
      servicePreviewGroupTitle: 'Model Services',
      builtinGroupTitle: (adapter) => `${adapter} built-in models`
    })

    expect(result.servicePreviewOptions).toMatchObject([
      {
        value: 'openai,gpt-5.4-2026-03-05',
        title: 'GPT-5.4',
        description: 'Latest flagship',
        serviceTitle: 'OpenAI'
      },
      {
        value: 'anthropic,claude-sonnet-4-6',
        description: undefined,
        serviceTitle: 'Anthropic'
      }
    ])
    expect(result.recommendedOptions).toEqual([])
  })

  it('does not fall back to service titles or descriptions for first-level option tooltips', () => {
    const result = buildModelSelectorData({
      activeBuiltinModels: {},
      availableServiceModels: [
        {
          serviceKey: 'openai',
          model: 'gpt-5.4-2026-03-05',
          selectorValue: 'openai,gpt-5.4-2026-03-05'
        },
        {
          serviceKey: 'anthropic',
          model: 'claude-sonnet-4-6',
          selectorValue: 'anthropic,claude-sonnet-4-6'
        }
      ],
      defaultModelService: 'openai',
      mergedModels: {},
      mergedModelServices: {
        openai: {
          title: 'OpenAI',
          description: 'General models',
          models: ['gpt-5.4-2026-03-05']
        },
        anthropic: {
          title: 'Anthropic',
          description: 'Reasoning models',
          models: ['claude-sonnet-4-6']
        }
      },
      recommendedModels: [],
      recommendedGroupTitle: 'Recommended Models',
      servicePreviewGroupTitle: 'Model Services',
      builtinGroupTitle: (adapter) => `${adapter} built-in models`
    })

    expect(result.servicePreviewOptions).toMatchObject([
      {
        value: 'openai,gpt-5.4-2026-03-05',
        description: undefined,
        tooltipLines: []
      },
      {
        value: 'anthropic,claude-sonnet-4-6',
        description: undefined,
        tooltipLines: []
      }
    ])
  })

  it('sorts recommended models alphabetically by display label while keeping service previews separate', () => {
    const result = buildModelSelectorData({
      activeBuiltinModels: {},
      availableServiceModels: [
        {
          serviceKey: 'gpt',
          model: 'gpt-5.4-2026-03-05',
          selectorValue: 'gpt,gpt-5.4-2026-03-05'
        },
        {
          serviceKey: 'ark',
          model: 'ep-20250831035308-tt5rn',
          selectorValue: 'ark,ep-20250831035308-tt5rn'
        }
      ],
      defaultModelService: 'gpt',
      mergedModels: {
        'gpt,gpt-5.4-2026-03-05': {
          title: 'Zeta'
        },
        'ark,ep-20250831035308-tt5rn': {
          title: 'Alpha'
        }
      },
      mergedModelServices: {
        gpt: {
          title: 'GPT',
          models: ['gpt-5.4-2026-03-05']
        },
        ark: {
          title: 'Ark',
          models: ['ep-20250831035308-tt5rn']
        }
      },
      recommendedModels: [
        {
          service: 'gpt',
          model: 'gpt-5.4-2026-03-05',
          placement: 'modelSelector'
        },
        {
          service: 'ark',
          model: 'ep-20250831035308-tt5rn',
          placement: 'modelSelector'
        }
      ],
      recommendedGroupTitle: 'Recommended Models',
      servicePreviewGroupTitle: 'Model Services',
      builtinGroupTitle: (adapter) => `${adapter} built-in models`
    })

    expect(result.servicePreviewOptions.map(option => option.title)).toEqual(['Zeta', 'Alpha'])
    expect(result.recommendedOptions.map(option => option.title)).toEqual(['Alpha', 'Zeta'])
  })
})
