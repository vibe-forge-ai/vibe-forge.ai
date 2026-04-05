import { describe, expect, it } from 'vitest'

import {
  buildUpdatedUserGeneralSection,
  toggleModelSelectorRecommendation
} from '#~/hooks/chat/model-selector-recommendations'

describe('model selector recommendations', () => {
  it('adds a model selector recommendation to the front of the user list', () => {
    const result = toggleModelSelectorRecommendation({
      currentRecommendedModels: [
        {
          service: 'anthropic',
          model: 'claude-sonnet-4-6'
        }
      ],
      nextRecommendedModel: {
        service: 'openai',
        model: 'gpt-5.4-2026-03-05',
        placement: 'modelSelector'
      }
    })

    expect(result.isCurrentlyRecommended).toBe(false)
    expect(result.recommendedModels).toEqual([
      {
        service: 'openai',
        model: 'gpt-5.4-2026-03-05',
        placement: 'modelSelector'
      },
      {
        service: 'anthropic',
        model: 'claude-sonnet-4-6'
      }
    ])
  })

  it('removes an existing model selector recommendation while preserving unrelated entries', () => {
    const result = toggleModelSelectorRecommendation({
      currentRecommendedModels: [
        {
          service: 'openai',
          model: 'gpt-5.4-2026-03-05',
          placement: 'modelSelector'
        },
        {
          service: 'anthropic',
          model: 'claude-sonnet-4-6'
        }
      ],
      nextRecommendedModel: {
        service: 'openai',
        model: 'gpt-5.4-2026-03-05',
        placement: 'modelSelector'
      }
    })

    expect(result.isCurrentlyRecommended).toBe(true)
    expect(result.recommendedModels).toEqual([
      {
        service: 'anthropic',
        model: 'claude-sonnet-4-6'
      }
    ])
  })

  it('preserves the rest of the user general section when only recommended models change', () => {
    const result = buildUpdatedUserGeneralSection({
      currentGeneral: {
        defaultModelService: 'openai',
        defaultModel: 'gpt-5.4-2026-03-05'
      },
      recommendedModels: [
        {
          service: 'openai',
          model: 'gpt-5.4-2026-03-05',
          placement: 'modelSelector'
        }
      ]
    })

    expect(result).toEqual({
      defaultModelService: 'openai',
      defaultModel: 'gpt-5.4-2026-03-05',
      recommendedModels: [
        {
          service: 'openai',
          model: 'gpt-5.4-2026-03-05',
          placement: 'modelSelector'
        }
      ]
    })
  })
})
