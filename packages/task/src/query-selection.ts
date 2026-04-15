import type { AdapterCtx } from '@vibe-forge/types'
import {
  listServiceModels,
  normalizeNonEmptyString,
  resolveAdapterConfiguredDefaultModel,
  resolveDefaultModelSelection,
  resolveModelDefaultAdapter,
  resolveModelSelection
} from '@vibe-forge/utils'

const pickFirstNonEmptyString = (values: unknown[]) =>
  values
    .map(normalizeNonEmptyString)
    .find((value): value is string => value != null)

export const resolveQuerySelection = (params: {
  mergedConfig?: AdapterCtx['configs'][0]
  inputAdapter?: string
  inputModel?: string
}) => {
  const mergedAdapters = params.mergedConfig?.adapters as Record<string, unknown> | undefined
  const mergedModels = params.mergedConfig?.models
  const mergedModelServices = params.mergedConfig?.modelServices ?? {}
  const availableAdapters = Object.keys(mergedAdapters ?? {})
  const serviceModels = listServiceModels(mergedModelServices)
  const mergedDefaultModelService = pickFirstNonEmptyString([params.mergedConfig?.defaultModelService])
  const explicitAdapter = normalizeNonEmptyString(params.inputAdapter)
  const explicitModel = resolveModelSelection({
    value: params.inputModel,
    serviceModels,
    preferredServiceKey: mergedDefaultModelService,
    preserveUnknown: true
  })
  const mergedDefaultAdapter = pickFirstNonEmptyString([params.mergedConfig?.defaultAdapter])
  const mergedDefaultModel = pickFirstNonEmptyString([params.mergedConfig?.defaultModel])
  const resolvedDefaultModel = resolveDefaultModelSelection({
    defaultModel: mergedDefaultModel,
    defaultModelService: mergedDefaultModelService,
    serviceModels,
    preserveUnknownDefaultModel: true
  })

  const resolveAdapterFallback = () => explicitAdapter ?? mergedDefaultAdapter ?? availableAdapters[0]

  const resolveAdapterForModel = (model: string) => (
    explicitAdapter ??
      resolveModelDefaultAdapter({
        model,
        models: mergedModels
      }) ??
      mergedDefaultAdapter ??
      availableAdapters[0]
  )

  const resolveModelForAdapter = (adapter: string | undefined) => {
    const adapterConfiguredModel = resolveAdapterConfiguredDefaultModel({
      adapterConfig: adapter != null ? mergedAdapters?.[adapter] : undefined,
      serviceModels,
      preferredServiceKey: mergedDefaultModelService,
      preserveUnknown: true
    })
    return adapterConfiguredModel ?? resolvedDefaultModel
  }

  if (explicitModel != null) {
    return {
      adapter: resolveAdapterForModel(explicitModel),
      model: explicitModel
    }
  }

  if (explicitAdapter != null) {
    return {
      adapter: explicitAdapter,
      model: resolveModelForAdapter(explicitAdapter)
    }
  }

  if (resolvedDefaultModel != null) {
    return {
      adapter: resolveAdapterForModel(resolvedDefaultModel),
      model: resolvedDefaultModel
    }
  }

  const adapter = resolveAdapterFallback()
  return {
    adapter,
    model: resolveModelForAdapter(adapter)
  }
}
