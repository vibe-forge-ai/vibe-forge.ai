import type { Config, ModelServiceConfig } from '@vibe-forge/core'

import { resolveTransformerPath } from './paths'

const normalizeServiceModel = (
  serviceKey: string,
  modelName: string,
  modelServices: Record<string, ModelServiceConfig>
) => {
  const service = modelServices[serviceKey]
  if (!service) return undefined
  const models = service.models ?? []
  const aliasEntries = Object.entries(service.modelsAlias ?? {})
  const aliasFromModel = aliasEntries.find(([, aliases]) => aliases.includes(modelName))?.[0]
  if (aliasFromModel) return aliasFromModel
  if (models.includes(modelName)) return modelName
  const aliasByKey = aliasEntries.find(([alias]) => alias === modelName)?.[0]
  return aliasByKey
}

const getServicePriority = (
  modelServices: Record<string, ModelServiceConfig>,
  config?: Config,
  userConfig?: Config
) => {
  const ordered = [
    userConfig?.defaultModelService,
    config?.defaultModelService,
    ...Object.keys(modelServices)
  ]
  const seen = new Set<string>()
  return ordered.filter((value): value is string => {
    if (!value || seen.has(value)) return false
    if (!modelServices[value]) return false
    seen.add(value)
    return true
  })
}

const resolveModelCandidate = (
  candidate: string,
  params: {
    modelServices: Record<string, ModelServiceConfig>
    config?: Config
    userConfig?: Config
    defaultService: string
  }
) => {
  const { modelServices, config, userConfig, defaultService } = params
  if (candidate.includes(',')) {
    const [serviceKey, modelName] = candidate.split(',').map(item => item.trim())
    if (!serviceKey || !modelName) return undefined
    const normalized = normalizeServiceModel(serviceKey, modelName, modelServices)
    return normalized ? `${serviceKey},${normalized}` : undefined
  }
  const servicePriority = [
    defaultService,
    ...getServicePriority(modelServices, config, userConfig)
  ].filter((value, index, array) => array.indexOf(value) === index)
  for (const serviceKey of servicePriority) {
    const normalized = normalizeServiceModel(serviceKey, candidate, modelServices)
    if (normalized) return `${serviceKey},${normalized}`
  }
  return undefined
}

const resolveDefaultModel = (params: {
  config?: Config
  userConfig?: Config
  modelServices: Record<string, ModelServiceConfig>
}) => {
  const { config, userConfig, modelServices } = params
  const providers = Object.entries(modelServices).map(([name, configValue]) => ({
    name,
    api_base_url: configValue.apiBaseUrl,
    api_key: configValue.apiKey,
    models: configValue.models,
    transformer: configValue.extra?.claudeCodeRouterTransformer
  }))
  const defaultProvider = providers[0]
  if (!defaultProvider) {
    throw new Error('No modelServices found in config')
  }
  const defaultModelServiceInput = userConfig?.defaultModelService ?? config?.defaultModelService
  const defaultModelServiceName = defaultModelServiceInput && modelServices[defaultModelServiceInput]
    ? defaultModelServiceInput
    : defaultProvider.name
  const defaultModelInput = userConfig?.defaultModel ?? config?.defaultModel
  const resolvedByInput = defaultModelInput
    ? resolveModelCandidate(defaultModelInput, {
      modelServices,
      config,
      userConfig,
      defaultService: defaultModelServiceName
    })
    : undefined
  if (resolvedByInput) {
    return {
      defaultModel: resolvedByInput,
      providers,
      defaultService: defaultModelServiceName
    }
  }
  const fallbackModelName = modelServices[defaultModelServiceName]?.models?.[0] ??
    defaultProvider.models?.[0]
  if (!fallbackModelName) {
    throw new Error(`模型服务 ${defaultModelServiceName} 无可用模型`)
  }
  const normalizedFallback = normalizeServiceModel(defaultModelServiceName, fallbackModelName, modelServices)
  if (!normalizedFallback) {
    throw new Error(`模型服务 ${defaultModelServiceName} 无可用模型`)
  }
  return {
    defaultModel: `${defaultModelServiceName},${normalizedFallback}`,
    providers,
    defaultService: defaultModelServiceName
  }
}

const resolveRouterModel = (params: {
  fallback?: string[]
  defaultModel: string
  defaultService: string
  modelServices: Record<string, ModelServiceConfig>
  config?: Config
  userConfig?: Config
}) => {
  const { fallback, defaultModel, defaultService, modelServices, config, userConfig } = params
  if (fallback && fallback.length > 0) {
    for (const candidate of fallback) {
      const resolved = resolveModelCandidate(candidate, {
        modelServices,
        config,
        userConfig,
        defaultService
      })
      if (resolved) return resolved
    }
  }
  return defaultModel
}

export const generateDefaultCCRConfigJSON = (params: {
  cwd: string
  config?: Config
  userConfig?: Config
  adapterOptions?: NonNullable<Config['adapters']>['claude-code']
}) => {
  const { cwd, config, userConfig, adapterOptions } = params
  const modelServices = {
    ...(config?.modelServices ?? {}),
    ...(userConfig?.modelServices ?? {})
  }
  const { defaultModel, providers, defaultService } = resolveDefaultModel({
    config,
    userConfig,
    modelServices
  })
  const loggerEnabled = adapterOptions?.ccrTransformers?.logger ?? true
  const transformers = [
    {
      path: resolveTransformerPath('gemini-open-router-polyfill.js')
    },
    {
      path: resolveTransformerPath('openai-polyfill.js')
    },
    ...(loggerEnabled
      ? [{ path: resolveTransformerPath('logger.js') }]
      : [])
  ]
  return JSON.stringify(
    {
      ...(adapterOptions?.ccrOptions ?? {}),
      transformers,
      Providers: providers,
      Router: {
        default: resolveRouterModel({
          fallback: adapterOptions?.modelFallbacks?.default,
          defaultModel,
          defaultService,
          modelServices,
          config,
          userConfig
        }),
        background: resolveRouterModel({
          fallback: adapterOptions?.modelFallbacks?.background,
          defaultModel,
          defaultService,
          modelServices,
          config,
          userConfig
        }),
        think: resolveRouterModel({
          fallback: adapterOptions?.modelFallbacks?.think,
          defaultModel,
          defaultService,
          modelServices,
          config,
          userConfig
        }),
        longContext: resolveRouterModel({
          fallback: adapterOptions?.modelFallbacks?.longContext,
          defaultModel,
          defaultService,
          modelServices,
          config,
          userConfig
        })
      }
    },
    null,
    2
  )
}
