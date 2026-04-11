import type { NativeModelRouteDescriptor } from '@vibe-forge/types'

export interface CodexProxyCatalog {
  routes: Map<string, NativeModelRouteDescriptor>
  currentNativeModelId: string | undefined
  onSelectorChange?: (newSelector: string) => void

  resolve(nativeModelId: string): NativeModelRouteDescriptor | undefined
  setCurrentModel(nativeModelId: string): void
}

export function createCodexProxyCatalog(params: {
  routes: NativeModelRouteDescriptor[]
  initialNativeModelId?: string
  onSelectorChange?: (newSelector: string) => void
}): CodexProxyCatalog {
  const { routes: routeList, initialNativeModelId, onSelectorChange } = params
  const routes = new Map<string, NativeModelRouteDescriptor>()
  const routesBySelector = new Map<string, NativeModelRouteDescriptor>()
  const routesByUpstreamModel = new Map<string, NativeModelRouteDescriptor>()

  for (const route of routeList) {
    routes.set(route.nativeModelId, route)
    routesBySelector.set(route.selectorValue, route)
    routesByUpstreamModel.set(route.upstreamModel, route)
  }

  const resolveRoute = (modelId: string) =>
    routes.get(modelId) ??
      routesBySelector.get(modelId) ??
      routesByUpstreamModel.get(modelId)

  const initialRoute = initialNativeModelId != null
    ? resolveRoute(initialNativeModelId)
    : undefined

  const catalog: CodexProxyCatalog = {
    routes,
    currentNativeModelId: initialRoute?.nativeModelId,
    onSelectorChange,

    resolve(nativeModelId: string) {
      return resolveRoute(nativeModelId)
    },

    setCurrentModel(nativeModelId: string) {
      if (nativeModelId === catalog.currentNativeModelId) return
      const route = resolveRoute(nativeModelId)
      if (route == null) return

      const previousRoute = catalog.currentNativeModelId != null
        ? resolveRoute(catalog.currentNativeModelId)
        : undefined

      catalog.currentNativeModelId = route.nativeModelId

      if (previousRoute == null || previousRoute.selectorValue !== route.selectorValue) {
        catalog.onSelectorChange?.(route.selectorValue)
      }
    }
  }

  return catalog
}
