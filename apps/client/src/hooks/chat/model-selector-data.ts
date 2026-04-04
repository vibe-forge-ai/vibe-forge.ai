import type { AdapterBuiltinModel, ModelServiceConfig, RecommendedModelConfig } from '@vibe-forge/types'

import type { ServiceModelEntry } from './model-selector'
import { buildServiceModelSelector, resolveServiceModelSelector } from './model-selector'

export interface ModelSelectOptionData {
  value: string
  title: string
  description?: string
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
  recommendedOptions: ModelSelectOptionData[]
  moreModelGroups: ModelSelectGroupData[]
  flatGroups: ModelSelectGroupData[]
  searchOptions: ModelSelectOptionData[]
}

export const buildModelSelectorData = (params: {
  activeBuiltinModels: Record<string, AdapterBuiltinModel[]>
  availableServiceModels: ServiceModelEntry[]
  defaultModelService?: string
  mergedModelServices: Record<string, ModelServiceConfig>
  recommendedModels: RecommendedModelConfig[]
  recommendedGroupTitle: string
  builtinGroupTitle: (adapterKey: string) => string
}): ModelSelectorData => {
  const buildOption = (option: {
    value: string
    title: string
    description?: string
    serviceKey?: string
    serviceTitle?: string
  }): ModelSelectOptionData => {
    const description = option.description?.trim()
    return {
      value: option.value,
      title: option.title,
      description,
      serviceKey: option.serviceKey,
      serviceTitle: option.serviceTitle,
      searchText: [
        option.title,
        option.value,
        option.serviceTitle,
        option.serviceKey,
        description
      ]
        .filter(Boolean)
        .join(' '),
      displayLabel: option.title
    }
  }

  const resolveFirstAlias = (modelsAlias: Record<string, string[]> | undefined, model: string) => {
    if (!modelsAlias) return undefined
    for (const [alias, aliasModels] of Object.entries(modelsAlias)) {
      if (!Array.isArray(aliasModels)) continue
      if (aliasModels.includes(model)) return alias
    }
    return undefined
  }

  const modelToService = new Map<string, { key: string; title: string }>()
  for (const entry of params.availableServiceModels) {
    const serviceValue = params.mergedModelServices[entry.serviceKey]
    const serviceTitle = serviceValue?.title?.trim() !== '' ? serviceValue?.title ?? '' : entry.serviceKey
    if (!modelToService.has(entry.model)) {
      modelToService.set(entry.model, { key: entry.serviceKey, title: serviceTitle })
    }
  }

  const serviceGroups = Object.entries(params.mergedModelServices)
    .map(([serviceKey, serviceValue]) => {
      const service = (serviceValue != null && typeof serviceValue === 'object')
        ? serviceValue
        : undefined
      const serviceTitle = service?.title?.trim() !== '' ? service?.title ?? '' : serviceKey
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
          const alias = resolveFirstAlias(service?.modelsAlias as Record<string, string[]> | undefined, model)
          return buildOption({
            value: buildServiceModelSelector(serviceKey, model),
            title: alias ?? model,
            description: alias ? model : serviceTitle,
            serviceKey,
            serviceTitle
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
        options: models.map((model) =>
          buildOption({
            value: model.value,
            title: model.title,
            description: model.description
          })
        )
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
        ? (serviceInfo?.title?.trim() !== '' ? serviceInfo?.title ?? '' : item.service)
        : modelToService.get(item.model)?.title
      const alias = item.service
        ? resolveFirstAlias(serviceInfo?.modelsAlias as Record<string, string[]> | undefined, item.model)
        : undefined
      const value = resolveServiceModelSelector({
        value: item.service ? buildServiceModelSelector(item.service, item.model) : item.model,
        serviceModels: params.availableServiceModels,
        preferredServiceKey: item.service ?? params.defaultModelService
      }) ?? item.model

      return buildOption({
        value,
        title: item.title?.trim() !== '' ? item.title ?? '' : (alias ?? item.model),
        description: item.description?.trim() !== '' ? item.description : serviceTitle,
        serviceKey: item.service ?? modelToService.get(item.model)?.key,
        serviceTitle
      })
    })

  const fallbackRecommendedOptions = configuredRecommendedOptions.length === 0
    ? serviceGroups
      .map((group) => {
        const firstOption = group.options[0]
        if (!firstOption) return null
        return {
          ...firstOption,
          description: group.description ?? firstOption.description
        }
      })
      .filter((option): option is ModelSelectOptionData => option != null)
    : []

  const recommendedOptions = configuredRecommendedOptions.length > 0
    ? configuredRecommendedOptions
    : fallbackRecommendedOptions

  const flatGroups: ModelSelectGroupData[] = []
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
  for (const option of [...recommendedOptions, ...moreModelGroups.flatMap(group => group.options)]) {
    if (!searchOptionMap.has(option.value)) {
      searchOptionMap.set(option.value, option)
    }
  }

  const searchOptions = Array.from(searchOptionMap.values())

  return {
    recommendedOptions,
    moreModelGroups,
    flatGroups,
    searchOptions
  }
}
