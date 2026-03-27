import type { AdapterConfigCommon, ModelMetadataConfig, ModelServiceConfig } from '../config/types'

export interface ServiceModelEntry {
  serviceKey: string
  model: string
  selectorValue: string
}

const asRecord = (value: unknown): Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
)

export const normalizeNonEmptyString = (value: unknown) => (
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
)

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
    return undefined
  }

  const candidates = params.serviceModels.filter(entry => entry.model === normalizedValue)
  if (candidates.length === 0) return undefined

  const preferredServiceKey = normalizeNonEmptyString(params.preferredServiceKey)
  if (preferredServiceKey) {
    const candidate = candidates.find(entry => entry.serviceKey === preferredServiceKey)
    if (candidate) return candidate.selectorValue
  }

  return candidates[0]?.selectorValue
}

export const resolveModelSelection = (params: {
  value?: string
  builtinModels?: Iterable<string>
  serviceModels: ServiceModelEntry[]
  preferredServiceKey?: string
  preserveUnknown?: boolean
}) => {
  const normalizedValue = normalizeNonEmptyString(params.value)
  if (!normalizedValue) return undefined

  const builtinModelSet = new Set(
    Array.from(params.builtinModels ?? [])
      .map(item => normalizeNonEmptyString(item))
      .filter((item): item is string => Boolean(item))
  )

  if (builtinModelSet.has(normalizedValue)) return normalizedValue

  const resolvedServiceModel = resolveServiceModelSelector({
    value: normalizedValue,
    serviceModels: params.serviceModels,
    preferredServiceKey: params.preferredServiceKey
  })
  if (resolvedServiceModel) return resolvedServiceModel

  const parsed = parseServiceModelSelector(normalizedValue)
  if (parsed?.modelName && builtinModelSet.has(parsed.modelName)) return parsed.modelName

  return params.preserveUnknown === false ? undefined : normalizedValue
}

export const resolveDefaultModelSelection = (params: {
  defaultModel?: string
  defaultModelService?: string
  builtinModels?: Iterable<string>
  serviceModels: ServiceModelEntry[]
  preserveUnknownDefaultModel?: boolean
}) => {
  const builtinModels = Array.from(params.builtinModels ?? [])
    .map(item => normalizeNonEmptyString(item))
    .filter((item): item is string => Boolean(item))
  const normalizedDefaultModel = normalizeNonEmptyString(params.defaultModel)

  if (normalizedDefaultModel) {
    const parsed = parseServiceModelSelector(normalizedDefaultModel)
    const resolvedModel = resolveModelSelection({
      value: normalizedDefaultModel,
      builtinModels,
      serviceModels: params.serviceModels,
      preferredServiceKey: parsed?.serviceKey ?? params.defaultModelService,
      preserveUnknown: params.preserveUnknownDefaultModel
    })
    if (resolvedModel) return resolvedModel
  }

  const normalizedDefaultModelService = normalizeNonEmptyString(params.defaultModelService)
  if (normalizedDefaultModelService) {
    const defaultServiceModel = params.serviceModels.find(entry => entry.serviceKey === normalizedDefaultModelService)
    if (defaultServiceModel) return defaultServiceModel.selectorValue
  }

  if (builtinModels.length > 0) return builtinModels[0]

  return params.serviceModels[0]?.selectorValue
}

export const resolveModelMetadata = (params: {
  model?: string
  models?: Record<string, ModelMetadataConfig>
}) => {
  const parsed = parseServiceModelSelector(normalizeNonEmptyString(params.model))
  if (!parsed) return undefined

  const exactMetadata = params.models?.[parsed.selectorValue]
  if (exactMetadata != null && typeof exactMetadata === 'object' && !Array.isArray(exactMetadata)) {
    return exactMetadata
  }

  const serviceMetadata = params.models?.[parsed.serviceKey]
  if (serviceMetadata != null && typeof serviceMetadata === 'object' && !Array.isArray(serviceMetadata)) {
    return serviceMetadata
  }

  return undefined
}

export const resolveModelDefaultAdapter = (params: {
  model?: string
  models?: Record<string, ModelMetadataConfig>
}) => normalizeNonEmptyString(resolveModelMetadata(params)?.defaultAdapter)

export const getAdapterConfiguredModel = (adapterConfig: unknown) => (
  normalizeNonEmptyString(asRecord(adapterConfig).model)
)

export const omitAdapterCommonConfig = <T extends Record<string, unknown> | undefined>(adapterConfig: T) => {
  const record = asRecord(adapterConfig)
  const { model: _model, ...nativeConfig } = record
  return nativeConfig as Omit<NonNullable<T>, keyof AdapterConfigCommon>
}
