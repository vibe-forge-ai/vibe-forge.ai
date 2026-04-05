import type {
  AdapterBuiltinModel,
  ModelMetadataConfig,
  ModelServiceConfig,
  RecommendedModelConfig
} from '@vibe-forge/types'

import type { ServiceModelEntry } from './model-selector'
import {
  buildServiceModelSelector,
  resolveModelDisplayMetadata,
  resolveModelServiceTitle,
  resolveServiceModelSelector
} from './model-selector'

export interface ModelSelectOptionData {
  value: string
  title: string
  description?: string
  aliases: string[]
  modelName: string
  tooltipLines: string[]
  serviceKey?: string
  serviceTitle?: string
  searchText: string
  displayLabel: string
}

export interface ModelSelectGroupData {
  key: string
  title: string
  description?: string
  options: ModelSelectOptionData[]
}

export interface ModelSelectorData {
  servicePreviewOptions: ModelSelectOptionData[]
  recommendedOptions: ModelSelectOptionData[]
  moreModelGroups: ModelSelectGroupData[]
  flatGroups: ModelSelectGroupData[]
  searchOptions: ModelSelectOptionData[]
}

export const buildModelSelectorData = (params: {
  activeBuiltinModels: Record<string, AdapterBuiltinModel[]>
  availableServiceModels: ServiceModelEntry[]
  defaultModelService?: string
  mergedModels: Record<string, ModelMetadataConfig>
  mergedModelServices: Record<string, ModelServiceConfig>
  recommendedModels: RecommendedModelConfig[]
  recommendedGroupTitle: string
  servicePreviewGroupTitle: string
  builtinGroupTitle: (adapterKey: string) => string
}): ModelSelectorData => {
  const sortOptionsByDisplayLabel = (options: ModelSelectOptionData[]) => {
    return [...options].sort((left, right) => {
      const labelComparison = left.displayLabel.localeCompare(right.displayLabel, undefined, {
        sensitivity: 'base'
      })
      if (labelComparison !== 0) return labelComparison

      const modelComparison = left.modelName.localeCompare(right.modelName, undefined, {
        sensitivity: 'base'
      })
      if (modelComparison !== 0) return modelComparison

      return left.value.localeCompare(right.value, undefined, {
        sensitivity: 'base'
      })
    })
  }

  const buildOption = (option: {
    value: string
    title: string
    modelName: string
    description?: string
    aliases?: string[]
    serviceKey?: string
    serviceTitle?: string
    searchTerms?: Array<string | undefined>
  }): ModelSelectOptionData => {
    const description = option.description?.trim()
    const aliases = Array.from(new Set((option.aliases ?? []).filter(Boolean)))
    const tooltipLines = [
      ...aliases.filter(alias => alias !== option.title),
      option.modelName !== option.title ? option.modelName : undefined,
      description
    ].filter((item): item is string => Boolean(item))

    return {
      value: option.value,
      title: option.title,
      description,
      aliases,
      modelName: option.modelName,
      tooltipLines,
      serviceKey: option.serviceKey,
      serviceTitle: option.serviceTitle,
      searchText: [
        option.title,
        option.modelName,
        option.value,
        option.serviceTitle,
        option.serviceKey,
        description,
        ...aliases,
        ...(option.searchTerms ?? [])
      ]
        .filter(Boolean)
        .join(' '),
      displayLabel: option.title
    }
  }

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

  const serviceGroups = Object.entries(params.mergedModelServices)
    .map(([serviceKey, serviceValue]) => {
      const service = (serviceValue != null && typeof serviceValue === 'object')
        ? serviceValue
        : undefined
      const serviceTitle = resolveModelServiceTitle({
        serviceKey,
        service
      })
      const title = serviceTitle?.trim() !== '' ? serviceTitle : serviceKey
      const models = Array.isArray(service?.models)
        ? service.models.filter((item: unknown): item is string => typeof item === 'string')
        : []

      if (models.length === 0) return null

      return {
        key: `service:${serviceKey}`,
        title,
        description: service?.description?.trim() || undefined,
        options: models.map((model) => {
          const value = buildServiceModelSelector(serviceKey, model)
          const metadata = resolveModelDisplayMetadata({
            model: value,
            models: params.mergedModels
          })

          return buildOption({
            value,
            title: metadata?.title ?? metadata?.aliases[0] ?? model,
            modelName: model,
            description: metadata?.description,
            aliases: metadata?.aliases,
            serviceKey,
            serviceTitle,
            searchTerms: [model, ...(metadata?.aliases ?? []), metadata?.title]
          })
        })
      }
    })
    .filter((group): group is NonNullable<typeof group> => group != null)

  const builtinGroups = Object.entries(params.activeBuiltinModels)
    .map(([adapterKey, models]) => {
      if (!Array.isArray(models) || models.length === 0) return null

      return {
        key: `builtin:${adapterKey}`,
        title: params.builtinGroupTitle(adapterKey),
        options: models.map((model) => {
          const metadata = resolveModelDisplayMetadata({
            model: model.value,
            models: params.mergedModels
          })

          return buildOption({
            value: model.value,
            title: metadata?.title ?? metadata?.aliases[0] ?? model.title,
            modelName: model.value,
            description: metadata?.description ?? model.description,
            aliases: metadata?.aliases,
            searchTerms: [model.value, ...(metadata?.aliases ?? []), metadata?.title]
          })
        })
      }
    })
    .filter((group): group is NonNullable<typeof group> => group != null)

  const configuredRecommendedOptions = params.recommendedModels
    .filter((item) => {
      if (item.placement && item.placement !== 'modelSelector') return false
      return resolveServiceModelSelector({
        value: item.service ? buildServiceModelSelector(item.service, item.model) : item.model,
        serviceModels: params.availableServiceModels,
        preferredServiceKey: item.service ?? params.defaultModelService
      }) != null
    })
    .map((item) => {
      const serviceInfo = item.service ? params.mergedModelServices[item.service] : undefined
      const serviceTitle = item.service
        ? resolveModelServiceTitle({
          serviceKey: item.service,
          service: serviceInfo
        })
        : modelToService.get(item.model)?.title
      const resolvedModel = item.service ? buildServiceModelSelector(item.service, item.model) : item.model
      const metadata = resolveModelDisplayMetadata({
        model: resolvedModel,
        models: params.mergedModels
      })
      const recommendedTitle = item.title?.trim()
      const recommendedDescription = item.description?.trim()
      const value = resolveServiceModelSelector({
        value: resolvedModel,
        serviceModels: params.availableServiceModels,
        preferredServiceKey: item.service ?? params.defaultModelService
      }) ?? item.model

      return buildOption({
        value,
        title: recommendedTitle || metadata?.title || metadata?.aliases[0] || item.model,
        modelName: item.model,
        description: recommendedDescription || metadata?.description,
        aliases: metadata?.aliases,
        serviceKey: item.service ?? modelToService.get(item.model)?.key,
        serviceTitle,
        searchTerms: [item.model, ...(metadata?.aliases ?? []), metadata?.title]
      })
    })

  const servicePreviewOptions = serviceGroups
    .map(group => group.options[0] ?? null)
    .filter((option): option is ModelSelectOptionData => option != null)

  const recommendedOptions = sortOptionsByDisplayLabel(configuredRecommendedOptions)

  const flatGroups: ModelSelectGroupData[] = []
  if (servicePreviewOptions.length > 0) {
    flatGroups.push({
      key: 'service-preview',
      title: params.servicePreviewGroupTitle,
      options: servicePreviewOptions
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
    servicePreviewOptions,
    recommendedOptions,
    moreModelGroups,
    flatGroups,
    searchOptions
  }
}
