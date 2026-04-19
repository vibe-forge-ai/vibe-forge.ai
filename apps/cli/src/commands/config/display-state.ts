import type { ModelMetadataConfig, ModelServiceConfig } from '@vibe-forge/types'

import type { ResolvedReadState } from './read-state'

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null &&
  typeof value === 'object' &&
  !Array.isArray(value)
)

const asModelMetadataRecord = (value: unknown): Record<string, ModelMetadataConfig> => (
  isRecord(value) ? value as Record<string, ModelMetadataConfig> : {}
)

const asModelServiceRecord = (value: unknown): Record<string, ModelServiceConfig> => (
  isRecord(value) ? value as Record<string, ModelServiceConfig> : {}
)

const resolveModelDisplayMetadata = (params: {
  selector: string
  serviceKey: string
  model: string
  modelMetadata: Record<string, ModelMetadataConfig>
}) => {
  const merged = {
    ...(params.modelMetadata[params.serviceKey] ?? {}),
    ...(params.modelMetadata[params.model] ?? {}),
    ...(params.modelMetadata[params.selector] ?? {})
  }

  return Object.keys(merged).length === 0 ? undefined : merged
}

const buildModelsDisplayValue = (params: {
  modelMetadata: Record<string, ModelMetadataConfig>
  modelServices: Record<string, ModelServiceConfig>
}) => {
  const consumedMetadataKeys = new Set<string>()

  const services = Object.fromEntries(
    Object.entries(params.modelServices).flatMap(([serviceKey, serviceValue]) => {
      const models = Array.isArray(serviceValue?.models)
        ? serviceValue.models.filter((model): model is string => typeof model === 'string' && model.trim() !== '')
        : []

      if (models.length === 0) {
        return []
      }

      const entries = Object.fromEntries(
        models.map((model) => {
          const selector = `${serviceKey},${model}`
          const metadata = resolveModelDisplayMetadata({
            selector,
            serviceKey,
            model,
            modelMetadata: params.modelMetadata
          })

          consumedMetadataKeys.add(serviceKey)
          consumedMetadataKeys.add(model)
          consumedMetadataKeys.add(selector)

          return [
            model,
            metadata == null
              ? {
                selector
              }
              : {
                selector,
                ...metadata
              }
          ]
        })
      )

      return [[serviceKey, entries]]
    })
  )

  if (Object.keys(services).length === 0) {
    return params.modelMetadata
  }

  const remainingMetadata = Object.fromEntries(
    Object.entries(params.modelMetadata)
      .filter(([key]) => !consumedMetadataKeys.has(key))
  )

  return Object.keys(remainingMetadata).length === 0
    ? services
    : {
      services,
      metadata: remainingMetadata
    }
}

export const resolveReadableConfigValue = (resolved: ResolvedReadState) => {
  if (resolved.resolvedPath?.section !== 'models' || resolved.resolvedPath.sectionPath.length > 0) {
    return resolved.value
  }

  return buildModelsDisplayValue({
    modelMetadata: asModelMetadataRecord(resolved.state.sections[resolved.source].models),
    modelServices: asModelServiceRecord(resolved.state.sections[resolved.source].modelServices)
  })
}
