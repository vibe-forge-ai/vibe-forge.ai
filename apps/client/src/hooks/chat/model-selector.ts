import type { ModelServiceConfig } from '@vibe-forge/core'

export interface ServiceModelEntry {
  serviceKey: string
  model: string
  selectorValue: string
}

const normalizeNonEmptyString = (value: string | undefined) => {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized === '' ? undefined : normalized
}

export const buildServiceModelSelector = (serviceKey: string, modelName: string) => `${serviceKey},${modelName}`

export const parseServiceModelSelector = (value: string | undefined) => {
  const normalizedValue = normalizeNonEmptyString(value)
  if (!normalizedValue || !normalizedValue.includes(',')) return undefined

  const [serviceKey, modelName] = normalizedValue.split(/,(.+)/)
  const normalizedServiceKey = normalizeNonEmptyString(serviceKey)
  const normalizedModelName = normalizeNonEmptyString(modelName)
  if (!normalizedServiceKey || !normalizedModelName) return undefined

  return {
    serviceKey: normalizedServiceKey,
    modelName: normalizedModelName,
    selectorValue: buildServiceModelSelector(normalizedServiceKey, normalizedModelName)
  }
}

export const listServiceModels = (modelServices: Record<string, ModelServiceConfig>) => {
  const list: ServiceModelEntry[] = []

  for (const [serviceKey, serviceValue] of Object.entries(modelServices)) {
    const normalizedServiceKey = normalizeNonEmptyString(serviceKey)
    if (!normalizedServiceKey) continue

    const service = (serviceValue != null && typeof serviceValue === 'object')
      ? serviceValue
      : undefined
    const models = Array.isArray(service?.models) ? service.models : []

    for (const model of models) {
      const normalizedModel = normalizeNonEmptyString(model)
      if (!normalizedModel) continue

      list.push({
        serviceKey: normalizedServiceKey,
        model: normalizedModel,
        selectorValue: buildServiceModelSelector(normalizedServiceKey, normalizedModel)
      })
    }
  }

  return list
}

const findExactServiceModel = (serviceModels: ServiceModelEntry[], serviceKey: string, modelName: string) => (
  serviceModels.find(entry => entry.serviceKey === serviceKey && entry.model === modelName)
)

export const resolveServiceModelSelector = (params: {
  value?: string
  serviceModels: ServiceModelEntry[]
  preferredServiceKey?: string
}) => {
  const normalizedValue = normalizeNonEmptyString(params.value)
  if (!normalizedValue) return undefined

  const parsed = parseServiceModelSelector(normalizedValue)
  if (parsed) {
    const exactMatch = findExactServiceModel(params.serviceModels, parsed.serviceKey, parsed.modelName)
    if (exactMatch) return exactMatch.selectorValue
  }

  const modelName = parsed?.modelName ?? normalizedValue
  const candidates = params.serviceModels.filter(entry => entry.model === modelName)
  if (candidates.length === 0) return undefined

  const preferredKeys = [parsed?.serviceKey, normalizeNonEmptyString(params.preferredServiceKey)]
    .filter((value, index, array): value is string => Boolean(value) && array.indexOf(value) === index)

  for (const preferredKey of preferredKeys) {
    const candidate = candidates.find(entry => entry.serviceKey === preferredKey)
    if (candidate) return candidate.selectorValue
  }

  return candidates[0]?.selectorValue
}

export const resolveChatModelSelection = (params: {
  value?: string
  builtinModels?: Iterable<string>
  serviceModels: ServiceModelEntry[]
  defaultModelService?: string
}) => {
  const normalizedValue = normalizeNonEmptyString(params.value)
  if (!normalizedValue) return undefined

  const builtinModelSet = new Set(
    Array.from(params.builtinModels ?? [])
      .map(item => normalizeNonEmptyString(item))
      .filter((item): item is string => Boolean(item))
  )

  if (builtinModelSet.has(normalizedValue)) return normalizedValue

  return resolveServiceModelSelector({
    value: normalizedValue,
    serviceModels: params.serviceModels,
    preferredServiceKey: params.defaultModelService
  })
}

export const resolveDefaultChatModelSelection = (params: {
  defaultModel?: string
  defaultModelService?: string
  builtinModels?: Iterable<string>
  serviceModels: ServiceModelEntry[]
}) => {
  const builtinModels = Array.from(params.builtinModels ?? [])
    .map(item => normalizeNonEmptyString(item))
    .filter((item): item is string => Boolean(item))
  const builtinModelSet = new Set(builtinModels)
  const normalizedDefaultModel = normalizeNonEmptyString(params.defaultModel)

  if (normalizedDefaultModel) {
    const parsed = parseServiceModelSelector(normalizedDefaultModel)
    const resolvedServiceModel = resolveServiceModelSelector({
      value: normalizedDefaultModel,
      serviceModels: params.serviceModels,
      preferredServiceKey: parsed?.serviceKey ?? params.defaultModelService
    })
    if (resolvedServiceModel) return resolvedServiceModel

    if (builtinModelSet.has(normalizedDefaultModel)) return normalizedDefaultModel
    if (parsed?.modelName && builtinModelSet.has(parsed.modelName)) return parsed.modelName
  }

  const normalizedDefaultModelService = normalizeNonEmptyString(params.defaultModelService)
  if (normalizedDefaultModelService) {
    const defaultServiceModel = params.serviceModels.find(entry => entry.serviceKey === normalizedDefaultModelService)
    if (defaultServiceModel) return defaultServiceModel.selectorValue
  }

  if (builtinModels.length > 0) return builtinModels[0]

  return params.serviceModels[0]?.selectorValue
}
