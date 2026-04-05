import type { AdapterBuiltinModel, ModelMetadataConfig, ServiceModelEntry } from '@vibe-forge/types'
import {
  buildServiceModelSelector,
  listServiceModels,
  mergeAdapterConfigs,
  normalizeNonEmptyString,
  parseServiceModelSelector,
  resolveAdapterConfiguredDefaultModel,
  resolveAdapterModelCompatibility,
  resolveDefaultModelSelection,
  resolveModelDefaultAdapter,
  resolveModelDisplayMetadata,
  resolveModelSelection,
  resolveServiceModelSelector
} from '@vibe-forge/utils/model-selection'

export type { ServiceModelEntry }
export {
  buildServiceModelSelector,
  listServiceModels,
  mergeAdapterConfigs,
  normalizeNonEmptyString,
  parseServiceModelSelector,
  resolveAdapterModelCompatibility,
  resolveModelDisplayMetadata,
  resolveServiceModelSelector
}

export const resolveModelServiceTitle = (params: {
  serviceKey: string
  service?: { title?: string | null } | null
}) => {
  return normalizeNonEmptyString(params.service?.title) ?? params.serviceKey
}

export const resolveChatModelSelection = (params: {
  value?: string
  builtinModels?: Iterable<string>
  serviceModels: ServiceModelEntry[]
  defaultModelService?: string
  preserveUnknown?: boolean
}) => {
  return resolveModelSelection({
    value: params.value,
    builtinModels: params.builtinModels,
    serviceModels: params.serviceModels,
    preferredServiceKey: params.defaultModelService,
    preserveUnknown: params.preserveUnknown
  })
}

export const resolveDefaultChatModelSelection = (params: {
  defaultModel?: string
  defaultModelService?: string
  builtinModels?: Iterable<string>
  serviceModels: ServiceModelEntry[]
  preserveUnknownDefaultModel?: boolean
}) => {
  return resolveDefaultModelSelection({
    defaultModel: params.defaultModel,
    defaultModelService: params.defaultModelService,
    builtinModels: params.builtinModels,
    serviceModels: params.serviceModels,
    preserveUnknownDefaultModel: params.preserveUnknownDefaultModel
  })
}

export const resolveChatAdapterSelection = (params: {
  value?: string
  availableAdapters: Iterable<string>
  defaultAdapter?: string
  preserveUnknown?: boolean
}) => {
  const normalizedValue = normalizeNonEmptyString(params.value)
  const adapterKeys = Array.from(params.availableAdapters)
  const adapterSet = new Set(adapterKeys)
  const normalizedDefaultAdapter = normalizeNonEmptyString(params.defaultAdapter)

  if (normalizedValue) {
    if (adapterSet.has(normalizedValue)) return normalizedValue
    if (params.preserveUnknown === true) return normalizedValue
  }
  if (normalizedDefaultAdapter && adapterSet.has(normalizedDefaultAdapter)) return normalizedDefaultAdapter
  return adapterKeys[0]
}

const findBuiltinModelAdapters = (
  model: string | undefined,
  adapterBuiltinModels: Record<string, AdapterBuiltinModel[]>
) => {
  const normalizedModel = normalizeNonEmptyString(model)
  if (!normalizedModel) return []

  return Object.entries(adapterBuiltinModels)
    .filter(([, models]) => Array.isArray(models) && models.some(item => item?.value === normalizedModel))
    .map(([adapterKey]) => adapterKey)
}

export const resolveAdapterForChatModelSelection = (params: {
  model?: string
  availableAdapters: Iterable<string>
  defaultAdapter?: string
  adapterBuiltinModels?: Record<string, AdapterBuiltinModel[]>
  modelMetadata?: Record<string, ModelMetadataConfig>
}) => {
  const adapterKeys = Array.from(params.availableAdapters)
  const adapterSet = new Set(adapterKeys)
  const metadataAdapter = resolveModelDefaultAdapter({
    model: params.model,
    models: params.modelMetadata
  })
  if (metadataAdapter && adapterSet.has(metadataAdapter)) return metadataAdapter

  const builtinAdapters = findBuiltinModelAdapters(
    params.model,
    params.adapterBuiltinModels ?? {}
  )
  const normalizedDefaultAdapter = normalizeNonEmptyString(params.defaultAdapter)
  if (normalizedDefaultAdapter && builtinAdapters.includes(normalizedDefaultAdapter)) return normalizedDefaultAdapter
  if (builtinAdapters.length > 0) return builtinAdapters[0]

  return resolveChatAdapterSelection({
    availableAdapters: adapterKeys,
    defaultAdapter: params.defaultAdapter
  })
}

export const resolveModelForChatAdapterSelection = (params: {
  adapter?: string
  adapters?: Record<string, unknown>
  defaultModel?: string
  defaultModelService?: string
  builtinModels?: Iterable<string>
  fallbackBuiltinModels?: Iterable<string>
  serviceModels: ServiceModelEntry[]
}) => {
  const adapterConfiguredModel = resolveAdapterConfiguredDefaultModel({
    adapterConfig: params.adapter != null ? params.adapters?.[params.adapter] : undefined,
    builtinModels: params.builtinModels,
    serviceModels: params.serviceModels,
    preferredServiceKey: params.defaultModelService,
    preserveUnknown: false
  })
  if (adapterConfiguredModel) return adapterConfiguredModel

  return resolveDefaultChatModelSelection({
    defaultModel: params.defaultModel,
    defaultModelService: params.defaultModelService,
    builtinModels: params.builtinModels ?? params.fallbackBuiltinModels,
    serviceModels: params.serviceModels,
    preserveUnknownDefaultModel: false
  })
}
