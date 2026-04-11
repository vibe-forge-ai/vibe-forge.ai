import type { NativeModelRouteDescriptor } from '@vibe-forge/types'

import { resolveNativeIdToSelector } from './native-model-catalog-internal'

export interface NativeModelCatalog {
  routes: NativeModelRouteDescriptor[]
  defaultRoute: NativeModelRouteDescriptor | undefined
  resolveSelector: (nativeModelId: string) => string | undefined
}

export function buildNativeModelCatalog(params: {
  builtinRoutes: NativeModelRouteDescriptor[]
  serviceRoutes: NativeModelRouteDescriptor[]
  defaultSelector?: string
}): NativeModelCatalog {
  const { builtinRoutes, serviceRoutes, defaultSelector } = params
  const routes = [...builtinRoutes, ...serviceRoutes].sort((a, b) => a.order - b.order)

  const defaultRoute = defaultSelector != null
    ? routes.find(r => r.selectorValue === defaultSelector) ?? routes[0]
    : routes[0]

  return {
    routes,
    defaultRoute,
    resolveSelector: (nativeModelId: string) => resolveNativeIdToSelector(nativeModelId, routes)
  }
}
