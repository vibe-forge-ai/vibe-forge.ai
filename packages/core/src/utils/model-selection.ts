import type { AdapterConfigCommon, ModelMetadataConfig, ModelServiceConfig } from '../config/types'

export interface ServiceModelEntry {
  serviceKey: string
  model: string
  selectorValue: string
}

export type AdapterModelRuleRejectionReason = 'not_included' | 'excluded'

export interface AdapterModelRuleEvaluation {
  allowed: boolean
  reason?: AdapterModelRuleRejectionReason
  includeModels: string[]
  excludeModels: string[]
}

export interface AdapterModelFallbackWarning {
  type: 'adapter_model_fallback'
  adapter: string
  requestedModel: string
  resolvedModel: string
  reason: AdapterModelRuleRejectionReason
  includeModels?: string[]
  excludeModels?: string[]
}

export interface AdapterModelFallbackError {
  type: 'missing_default_model' | 'default_model_not_allowed'
  adapter: string
  requestedModel: string
  defaultModel?: string
  reason: AdapterModelRuleRejectionReason
  includeModels?: string[]
  excludeModels?: string[]
}

export interface AdapterModelCompatibilityResult {
  model?: string
  warning?: AdapterModelFallbackWarning
  error?: AdapterModelFallbackError
}

const asRecord = (value: unknown): Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
)

const asStringArray = (value: unknown) => (
  Array.isArray(value)
    ? value
      .map(item => normalizeNonEmptyString(item))
      .filter((item): item is string => Boolean(item))
    : []
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

export const mergeAdapterConfigs = <
  T extends Record<string, unknown> | undefined
>(
  left: T,
  right: T
) => {
  const keys = new Set([
    ...Object.keys(left ?? {}),
    ...Object.keys(right ?? {})
  ])

  const merged = Object.fromEntries(
    Array.from(keys).map((key) => [
      key,
      {
        ...asRecord(left?.[key]),
        ...asRecord(right?.[key])
      }
    ])
  )

  return merged as T
}

export const getAdapterConfiguredDefaultModel = (adapterConfig: unknown) => {
  const record = asRecord(adapterConfig)
  return normalizeNonEmptyString(record.defaultModel) ?? normalizeNonEmptyString(record.model)
}

export const getAdapterConfiguredIncludeModels = (adapterConfig: unknown) => (
  asStringArray(asRecord(adapterConfig).includeModels)
)

export const getAdapterConfiguredExcludeModels = (adapterConfig: unknown) => (
  asStringArray(asRecord(adapterConfig).excludeModels)
)

export const resolveAdapterConfiguredDefaultModel = (params: {
  adapterConfig?: unknown
  builtinModels?: Iterable<string>
  serviceModels: ServiceModelEntry[]
  preferredServiceKey?: string
  preserveUnknown?: boolean
}) => {
  const configuredModel = getAdapterConfiguredDefaultModel(params.adapterConfig)
  return resolveModelSelection({
    value: configuredModel,
    builtinModels: params.builtinModels,
    serviceModels: params.serviceModels,
    preferredServiceKey: params.preferredServiceKey,
    preserveUnknown: params.preserveUnknown
  })
}

export const doesModelMatchSelector = (params: {
  model?: string
  selector?: string
}) => {
  const normalizedModel = normalizeNonEmptyString(params.model)
  const normalizedSelector = normalizeNonEmptyString(params.selector)
  if (!normalizedModel || !normalizedSelector) return false

  const parsedModel = parseServiceModelSelector(normalizedModel)
  const parsedSelector = parseServiceModelSelector(normalizedSelector)

  if (parsedSelector) {
    return parsedModel?.selectorValue === parsedSelector.selectorValue
  }

  if (parsedModel) {
    return parsedModel.serviceKey === normalizedSelector
  }

  return normalizedModel === normalizedSelector
}

export const evaluateAdapterModelRules = (params: {
  model?: string
  adapterConfig?: unknown
}): AdapterModelRuleEvaluation => {
  const normalizedModel = normalizeNonEmptyString(params.model)
  const includeModels = getAdapterConfiguredIncludeModels(params.adapterConfig)
  const excludeModels = getAdapterConfiguredExcludeModels(params.adapterConfig)
  const isAdapterDefaultModel = normalizedModel?.toLowerCase() === 'default'

  if (!normalizedModel) {
    return {
      allowed: true,
      includeModels,
      excludeModels
    }
  }

  if (excludeModels.some(selector => doesModelMatchSelector({ model: normalizedModel, selector }))) {
    return {
      allowed: false,
      reason: 'excluded',
      includeModels,
      excludeModels
    }
  }

  if (
    !isAdapterDefaultModel &&
    includeModels.length > 0 &&
    !includeModels.some(selector => doesModelMatchSelector({ model: normalizedModel, selector }))
  ) {
    return {
      allowed: false,
      reason: 'not_included',
      includeModels,
      excludeModels
    }
  }

  return {
    allowed: true,
    includeModels,
    excludeModels
  }
}

export const resolveAdapterModelCompatibility = (params: {
  adapter: string
  model?: string
  adapterConfig?: unknown
  builtinModels?: Iterable<string>
  serviceModels: ServiceModelEntry[]
  preferredServiceKey?: string
  preserveUnknownDefaultModel?: boolean
}): AdapterModelCompatibilityResult => {
  const normalizedModel = normalizeNonEmptyString(params.model)
  if (!normalizedModel) {
    return { model: normalizedModel }
  }

  const evaluation = evaluateAdapterModelRules({
    model: normalizedModel,
    adapterConfig: params.adapterConfig
  })
  if (evaluation.allowed) {
    return { model: normalizedModel }
  }

  const resolvedDefaultModel = resolveAdapterConfiguredDefaultModel({
    adapterConfig: params.adapterConfig,
    builtinModels: params.builtinModels,
    serviceModels: params.serviceModels,
    preferredServiceKey: params.preferredServiceKey,
    preserveUnknown: params.preserveUnknownDefaultModel
  })

  if (!resolvedDefaultModel) {
    return {
      error: {
        type: 'missing_default_model',
        adapter: params.adapter,
        requestedModel: normalizedModel,
        defaultModel: getAdapterConfiguredDefaultModel(params.adapterConfig),
        reason: evaluation.reason ?? 'not_included',
        includeModels: evaluation.includeModels.length > 0 ? evaluation.includeModels : undefined,
        excludeModels: evaluation.excludeModels.length > 0 ? evaluation.excludeModels : undefined
      }
    }
  }

  const fallbackEvaluation = evaluateAdapterModelRules({
    model: resolvedDefaultModel,
    adapterConfig: params.adapterConfig
  })
  if (!fallbackEvaluation.allowed) {
    return {
      error: {
        type: 'default_model_not_allowed',
        adapter: params.adapter,
        requestedModel: normalizedModel,
        defaultModel: resolvedDefaultModel,
        reason: fallbackEvaluation.reason ?? 'not_included',
        includeModels: fallbackEvaluation.includeModels.length > 0 ? fallbackEvaluation.includeModels : undefined,
        excludeModels: fallbackEvaluation.excludeModels.length > 0 ? fallbackEvaluation.excludeModels : undefined
      }
    }
  }

  return {
    model: resolvedDefaultModel,
    warning: {
      type: 'adapter_model_fallback',
      adapter: params.adapter,
      requestedModel: normalizedModel,
      resolvedModel: resolvedDefaultModel,
      reason: evaluation.reason ?? 'not_included',
      includeModels: evaluation.includeModels.length > 0 ? evaluation.includeModels : undefined,
      excludeModels: evaluation.excludeModels.length > 0 ? evaluation.excludeModels : undefined
    }
  }
}

export const omitAdapterCommonConfig = <T extends Record<string, unknown> | undefined>(adapterConfig: T) => {
  const record = asRecord(adapterConfig)
  const {
    defaultModel: _defaultModel,
    model: _legacyModel,
    includeModels: _includeModels,
    excludeModels: _excludeModels,
    ...nativeConfig
  } = record
  return nativeConfig as Omit<NonNullable<T>, keyof AdapterConfigCommon | 'model'>
}
