import type {
  AdapterBuiltinModel,
  ModelMetadataConfig,
  ModelServiceConfig,
  RecommendedModelConfig
} from '@vibe-forge/types'

import type { ServiceModelEntry } from './model-selector'
import { resolveModelServiceTitle } from './model-selector'
import {
  buildBuiltinModelGroups,
  buildRecommendedModelOptions,
  buildServiceModelGroups
} from './model-selector-data-builders'
import { sortOptionsByDisplayLabel } from './model-selector-data-option-utils'
import type { ModelSelectGroupData, ModelSelectOptionData, ModelSelectorData } from './model-selector-data-types'

export type { ModelSelectGroupData, ModelSelectOptionData, ModelSelectorData } from './model-selector-data-types'

export const buildModelSelectorData = (params: {
  activeBuiltinModels: Record<string, AdapterBuiltinModel[]>
  availableServiceModels: ServiceModelEntry[]
  defaultModelService?: string
  mergedModels: Record<string, ModelMetadataConfig>
  mergedModelServices: Record<string, ModelServiceConfig>
  preferredAdapterKey?: string
  preferredPreviewGroupTitle?: string
  preferredBuiltinPreviewCount?: number
  recommendedModels: RecommendedModelConfig[]
  recommendedGroupTitle: string
  servicePreviewGroupTitle: string
  builtinGroupTitle: (adapterKey: string) => string
}): ModelSelectorData => {
  const modelToService = new Map<string, { key: string; title: string }>()
  for (const entry of params.availableServiceModels) {
    const serviceValue = params.mergedModelServices[entry.serviceKey]
    const serviceTitle = resolveModelServiceTitle({
      serviceKey: entry.serviceKey,
      service: serviceValue
    })
    if (!modelToService.has(entry.model)) {
      modelToService.set(entry.model, { key: entry.serviceKey, title: serviceTitle })
    }
  }

  const serviceGroups = buildServiceModelGroups({
    mergedModelServices: params.mergedModelServices,
    mergedModels: params.mergedModels
  })
  const builtinGroups = buildBuiltinModelGroups({
    activeBuiltinModels: params.activeBuiltinModels,
    builtinGroupTitle: params.builtinGroupTitle,
    mergedModels: params.mergedModels
  })
  const configuredRecommendedOptions = buildRecommendedModelOptions({
    availableServiceModels: params.availableServiceModels,
    defaultModelService: params.defaultModelService,
    mergedModels: params.mergedModels,
    mergedModelServices: params.mergedModelServices,
    recommendedModels: params.recommendedModels,
    modelToService
  })

  const preferredBuiltinGroup = params.preferredAdapterKey == null
    ? undefined
    : builtinGroups.find(group => group.key === `builtin:${params.preferredAdapterKey}`)
  const preferredBuiltinPreviewOptions = preferredBuiltinGroup?.options.slice(
    0,
    params.preferredBuiltinPreviewCount ?? 4
  ) ?? []
  const preferredBuiltinPreviewTitles = new Set(
    preferredBuiltinPreviewOptions.map(option => option.title.trim().toLowerCase())
  )

  const servicePreviewOptions = serviceGroups
    .map(group => group.options[0] ?? null)
    .filter((option): option is ModelSelectOptionData => option != null)
    .filter((option) => {
      if (preferredBuiltinPreviewTitles.size === 0) {
        return true
      }
      return !preferredBuiltinPreviewTitles.has(option.title.trim().toLowerCase())
    })

  const recommendedOptions = sortOptionsByDisplayLabel(configuredRecommendedOptions)
  const previewOptions = [
    ...preferredBuiltinPreviewOptions,
    ...servicePreviewOptions
  ]

  const flatGroups: ModelSelectGroupData[] = []
  if (previewOptions.length > 0) {
    flatGroups.push({
      key: 'service-preview',
      title: preferredBuiltinPreviewOptions.length > 0
        ? (params.preferredPreviewGroupTitle ?? params.servicePreviewGroupTitle)
        : params.servicePreviewGroupTitle,
      options: previewOptions
    })
  }

  if (recommendedOptions.length > 0) {
    flatGroups.push({
      key: 'recommended',
      title: params.recommendedGroupTitle,
      options: recommendedOptions
    })
  }

  const moreModelGroups = [...builtinGroups, ...serviceGroups]
  flatGroups.push(...moreModelGroups)

  const searchOptionMap = new Map<string, ModelSelectOptionData>()
  for (
    const option of [
      ...preferredBuiltinPreviewOptions,
      ...recommendedOptions,
      ...servicePreviewOptions,
      ...moreModelGroups.flatMap(group => group.options)
    ]
  ) {
    if (!searchOptionMap.has(option.value)) {
      searchOptionMap.set(option.value, option)
    }
  }

  const searchOptions = Array.from(searchOptionMap.values())

  return {
    servicePreviewOptions: previewOptions,
    recommendedOptions,
    moreModelGroups,
    flatGroups,
    searchOptions
  }
}
