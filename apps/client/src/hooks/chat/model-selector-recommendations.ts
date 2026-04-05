import type { ConfigSection, RecommendedModelConfig } from '@vibe-forge/types'

const MODEL_SELECTOR_RECOMMENDATION_PLACEMENT = 'modelSelector' as const

const isRecommendedModelConfig = (value: unknown): value is RecommendedModelConfig => (
  value != null &&
  typeof value === 'object' &&
  typeof (value as RecommendedModelConfig).model === 'string' &&
  (value as RecommendedModelConfig).model.trim() !== ''
)

export const isModelSelectorRecommendation = (value: RecommendedModelConfig) => (
  value.placement == null || value.placement === MODEL_SELECTOR_RECOMMENDATION_PLACEMENT
)

export const buildRecommendedModelKey = ({
  model,
  service
}: {
  model: string
  service?: string
}) => `${service ?? ''}::${model}`

export const buildUpdatedUserGeneralSection = ({
  currentGeneral,
  recommendedModels
}: {
  currentGeneral?: ConfigSection['general']
  recommendedModels: RecommendedModelConfig[]
}) => ({
  ...(currentGeneral ?? {}),
  recommendedModels: recommendedModels.length > 0 ? recommendedModels : undefined
})

export const toggleModelSelectorRecommendation = ({
  currentRecommendedModels,
  nextRecommendedModel
}: {
  currentRecommendedModels: unknown
  nextRecommendedModel: RecommendedModelConfig
}) => {
  const normalizedCurrentRecommendedModels = Array.isArray(currentRecommendedModels)
    ? currentRecommendedModels.filter(isRecommendedModelConfig)
    : []
  const nextRecommendedModelKey = buildRecommendedModelKey(nextRecommendedModel)
  const isCurrentlyRecommended = normalizedCurrentRecommendedModels.some(item => (
    isModelSelectorRecommendation(item) &&
    buildRecommendedModelKey(item) === nextRecommendedModelKey
  ))

  return {
    isCurrentlyRecommended,
    recommendedModels: isCurrentlyRecommended
      ? normalizedCurrentRecommendedModels.filter(item =>
        !(
          isModelSelectorRecommendation(item) &&
          buildRecommendedModelKey(item) === nextRecommendedModelKey
        )
      )
      : [
        {
          service: nextRecommendedModel.service,
          model: nextRecommendedModel.model,
          placement: MODEL_SELECTOR_RECOMMENDATION_PLACEMENT
        },
        ...normalizedCurrentRecommendedModels
      ]
  }
}
