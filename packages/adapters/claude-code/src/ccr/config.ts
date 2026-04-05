import { createHash } from 'node:crypto'

import type { Config, ModelServiceConfig } from '@vibe-forge/types'
import { resolveModelDisplayMetadata } from '@vibe-forge/utils'

import { resolveTransformerPath } from './paths'

const DEFAULT_ROUTER_PORT_RANGE_START = 20000
const DEFAULT_ROUTER_PORT_RANGE_SIZE = 20000

const getServiceQueryParams = (service: ModelServiceConfig) => {
  const extra = (service.extra ?? {}) as {
    codex?: {
      queryParams?: Record<string, string>
    }
    claudeCodeRouter?: {
      queryParams?: Record<string, string>
    }
  }

  return extra.claudeCodeRouter?.queryParams ?? extra.codex?.queryParams
}

const buildProviderBaseUrl = (service: ModelServiceConfig) => {
  const queryParams = getServiceQueryParams(service)
  if (queryParams == null || Object.keys(queryParams).length === 0) {
    return service.apiBaseUrl
  }

  const url = new URL(service.apiBaseUrl)
  for (const [key, value] of Object.entries(queryParams)) {
    if (typeof value !== 'string' || value.trim() === '') continue
    url.searchParams.set(key, value)
  }
  return url.toString()
}

const normalizePositiveInteger = (value: unknown): number | undefined => (
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : undefined
)

export const resolveDefaultClaudeCodeRouterPort = (cwd: string) => {
  const digest = createHash('sha256').update(cwd).digest()
  const hashValue = digest.readUInt32BE(0)
  return DEFAULT_ROUTER_PORT_RANGE_START + (hashValue % DEFAULT_ROUTER_PORT_RANGE_SIZE)
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const hasMaxtokenTransformer = (use: unknown[]) =>
  use.some((entry) => {
    if (entry === 'maxtoken') return true
    return Array.isArray(entry) && entry[0] === 'maxtoken'
  })

const buildProviderTransformer = (service: ModelServiceConfig) => {
  const baseValue = service.extra?.claudeCodeRouterTransformer
  const maxOutputTokens = normalizePositiveInteger(service.maxOutputTokens)

  if (maxOutputTokens == null) return baseValue
  if (!isPlainObject(baseValue)) {
    return {
      use: [
        ['maxtoken', { max_tokens: maxOutputTokens }]
      ]
    }
  }

  const use = Array.isArray(baseValue.use) ? [...baseValue.use] : []
  if (!hasMaxtokenTransformer(use)) {
    use.push(['maxtoken', { max_tokens: maxOutputTokens }])
  }

  return {
    ...baseValue,
    use
  }
}

const normalizeServiceModel = (
  serviceKey: string,
  modelName: string,
  modelServices: Record<string, ModelServiceConfig>,
  modelMetadata?: Config['models']
) => {
  const service = modelServices[serviceKey]
  if (!service) return undefined
  const models = service.models ?? []

  const resolveModelAliases = (candidate: string) =>
    resolveModelDisplayMetadata({
      model: `${serviceKey},${candidate}`,
      models: modelMetadata
    })?.aliases ?? []

  if (models.includes(modelName)) {
    return modelName
  }

  const aliasedModel = models.find(candidate => resolveModelAliases(candidate).includes(modelName))
  if (aliasedModel) {
    return aliasedModel
  }

  return undefined
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
    modelMetadata?: Config['models']
    config?: Config
    userConfig?: Config
    defaultService: string
  }
) => {
  const { modelServices, modelMetadata, config, userConfig, defaultService } = params
  if (candidate.includes(',')) {
    const [serviceKey, modelName] = candidate.split(',').map(item => item.trim())
    if (!serviceKey || !modelName) return undefined
    const normalized = normalizeServiceModel(serviceKey, modelName, modelServices, modelMetadata)
    return normalized ? `${serviceKey},${normalized}` : undefined
  }
  const servicePriority = [
    defaultService,
    ...getServicePriority(modelServices, config, userConfig)
  ].filter((value, index, array) => array.indexOf(value) === index)
  for (const serviceKey of servicePriority) {
    const normalized = normalizeServiceModel(serviceKey, candidate, modelServices, modelMetadata)
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
  const modelMetadata = {
    ...(config?.models ?? {}),
    ...(userConfig?.models ?? {})
  }
  const providers = Object.entries(modelServices).map(([name, configValue]) => ({
    name,
    api_base_url: buildProviderBaseUrl(configValue),
    api_key: configValue.apiKey,
    models: configValue.models,
    transformer: buildProviderTransformer(configValue)
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
      modelMetadata,
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
  const normalizedFallback = normalizeServiceModel(
    defaultModelServiceName,
    fallbackModelName,
    modelServices,
    modelMetadata
  )
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
  modelMetadata?: Config['models']
  config?: Config
  userConfig?: Config
}) => {
  const { fallback, defaultModel, defaultService, modelServices, modelMetadata, config, userConfig } = params
  if (fallback && fallback.length > 0) {
    for (const candidate of fallback) {
      const resolved = resolveModelCandidate(candidate, {
        modelServices,
        modelMetadata,
        config,
        userConfig,
        defaultService
      })
      if (resolved) return resolved
    }
  }
  return defaultModel
}

const resolveCompatibleApiTimeoutMs = (params: {
  defaultService: string
  modelServices: Record<string, ModelServiceConfig>
  adapterOptions?: NonNullable<Config['adapters']>['claude-code']
}) => {
  const { defaultService, modelServices, adapterOptions } = params
  const explicitCcrTimeout = normalizePositiveInteger(
    (adapterOptions?.ccrOptions as Record<string, unknown> | undefined)?.API_TIMEOUT_MS
  )
  if (explicitCcrTimeout != null) return explicitCcrTimeout

  const adapterTimeout = normalizePositiveInteger(adapterOptions?.apiTimeout)
  if (adapterTimeout != null) return adapterTimeout

  const timeoutByService = Object.fromEntries(
    Object.entries(modelServices)
      .map(([serviceKey, service]) => [serviceKey, normalizePositiveInteger(service.timeoutMs)] as const)
      .filter((entry): entry is [string, number] => entry[1] != null)
  )
  const uniqueTimeouts = Array.from(new Set(Object.values(timeoutByService)))
  if (uniqueTimeouts.length === 0) return undefined
  if (uniqueTimeouts.length === 1) return uniqueTimeouts[0]
  return timeoutByService[defaultService] ?? uniqueTimeouts[0]
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
  const modelMetadata = {
    ...(config?.models ?? {}),
    ...(userConfig?.models ?? {})
  }
  const { defaultModel, providers, defaultService } = resolveDefaultModel({
    config,
    userConfig,
    modelServices
  })
  const loggerEnabled = adapterOptions?.ccrTransformers?.logger ?? true
  const apiTimeoutMs = resolveCompatibleApiTimeoutMs({
    defaultService,
    modelServices,
    adapterOptions
  })
  const routerPort = normalizePositiveInteger(
    (adapterOptions?.ccrOptions as Record<string, unknown> | undefined)?.PORT
  ) ?? resolveDefaultClaudeCodeRouterPort(cwd)
  const transformers = [
    {
      path: resolveTransformerPath('gemini-open-router-polyfill')
    },
    {
      path: resolveTransformerPath('openai-polyfill')
    },
    ...(loggerEnabled
      ? [{ path: resolveTransformerPath('logger') }]
      : [])
  ]
  return JSON.stringify(
    {
      PORT: String(routerPort),
      ...(adapterOptions?.ccrOptions ?? {}),
      ...(apiTimeoutMs != null ? { API_TIMEOUT_MS: apiTimeoutMs } : {}),
      transformers,
      Providers: providers,
      Router: {
        default: resolveRouterModel({
          fallback: adapterOptions?.modelFallbacks?.default,
          defaultModel,
          defaultService,
          modelServices,
          modelMetadata,
          config,
          userConfig
        }),
        background: resolveRouterModel({
          fallback: adapterOptions?.modelFallbacks?.background,
          defaultModel,
          defaultService,
          modelServices,
          modelMetadata,
          config,
          userConfig
        }),
        think: resolveRouterModel({
          fallback: adapterOptions?.modelFallbacks?.think,
          defaultModel,
          defaultService,
          modelServices,
          modelMetadata,
          config,
          userConfig
        }),
        longContext: resolveRouterModel({
          fallback: adapterOptions?.modelFallbacks?.longContext,
          defaultModel,
          defaultService,
          modelServices,
          modelMetadata,
          config,
          userConfig
        })
      }
    },
    null,
    2
  )
}
