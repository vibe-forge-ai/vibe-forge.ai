import type {
  ModelMetadataConfig,
  ModelServiceConfig,
  NativeModelRouteDescriptor,
  RecommendedModelConfig
} from '@vibe-forge/types'

import { resolveModelDisplayMetadata } from './model-selection'

export interface ResolvedBuiltinPassthroughUpstream {
  upstreamBaseUrl: string
  headers?: Record<string, string>
  upstreamModel: string
}

const normalizePositiveInteger = (value: unknown): number | undefined => (
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : undefined
)

export function resolveBuiltinPassthroughRoutes(params: {
  builtinModels: Array<{ value: string; title: string; description: string }>
  resolveUpstream: (builtinValue: string) => ResolvedBuiltinPassthroughUpstream | undefined
  models?: Record<string, ModelMetadataConfig>
  baseOrder: number
}): NativeModelRouteDescriptor[] {
  const { builtinModels, resolveUpstream, models, baseOrder } = params
  const routes: NativeModelRouteDescriptor[] = []

  for (let i = 0; i < builtinModels.length; i++) {
    const builtin = builtinModels[i]
    const upstream = resolveUpstream(builtin.value)
    if (upstream == null) continue

    const display = resolveModelDisplayMetadata({ model: builtin.value, models })

    routes.push({
      selectorValue: builtin.value,
      nativeModelId: builtin.value,
      title: display?.title ?? builtin.title,
      description: display?.description ?? builtin.description,
      order: baseOrder + i,
      kind: 'builtin_passthrough',
      upstreamModel: upstream.upstreamModel,
      upstreamBaseUrl: upstream.upstreamBaseUrl,
      headers: upstream.headers
    })
  }

  return routes
}

export function resolveServiceRoutes(params: {
  modelServices: Record<string, ModelServiceConfig>
  models?: Record<string, ModelMetadataConfig>
  recommendedModels?: RecommendedModelConfig[]
  nativeIdStrategy: 'selector' | 'vf_prefixed'
  baseOrder: number
  resolveServiceMeta?: (serviceKey: string, service: ModelServiceConfig) => {
    headers?: Record<string, string>
    queryParams?: Record<string, string>
    upstreamBaseUrl?: string
  } | undefined
}): NativeModelRouteDescriptor[] {
  const { modelServices, models, recommendedModels, nativeIdStrategy, baseOrder, resolveServiceMeta } = params
  const routes: NativeModelRouteDescriptor[] = []
  let index = 0

  for (const [serviceKey, service] of Object.entries(modelServices)) {
    const serviceModels = service.models ?? []
    if (typeof service.apiBaseUrl !== 'string' || service.apiBaseUrl.trim() === '') continue

    const serviceMeta = resolveServiceMeta?.(serviceKey, service)

    for (const modelName of serviceModels) {
      const selectorValue = `${serviceKey},${modelName}`
      const nativeModelId = nativeIdStrategy === 'selector'
        ? selectorValue
        : `vf::${serviceKey}::${modelName}`

      const display = resolveModelDisplayMetadata({ model: selectorValue, models })
      const recommended = recommendedModels?.find(
        r => r.model === modelName && (r.service == null || r.service === serviceKey)
      )
      const maxOutputTokens = normalizePositiveInteger(service.maxOutputTokens)

      routes.push({
        selectorValue,
        nativeModelId,
        title: display?.title ?? recommended?.title ?? modelName,
        description: display?.description ?? recommended?.description ?? service.description,
        order: baseOrder + index,
        kind: 'service',
        serviceKey,
        upstreamModel: modelName,
        upstreamBaseUrl: serviceMeta?.upstreamBaseUrl ?? service.apiBaseUrl,
        headers: serviceMeta?.headers,
        queryParams: serviceMeta?.queryParams,
        maxOutputTokens
      })
      index++
    }
  }

  return routes
}

export function resolveNativeIdToSelector(
  nativeModelId: string,
  catalog: NativeModelRouteDescriptor[]
): string | undefined {
  const route = catalog.find(r => r.nativeModelId === nativeModelId)
  if (route != null) return route.selectorValue
  const byUpstream = catalog.find(r => r.upstreamModel === nativeModelId)
  return byUpstream?.selectorValue
}
