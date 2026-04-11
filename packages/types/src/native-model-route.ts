export type NativeModelRouteKind = 'service' | 'builtin_passthrough'

interface NativeModelRouteBase {
  selectorValue: string
  nativeModelId: string
  title: string
  description?: string
  order: number
  upstreamModel: string
  upstreamBaseUrl: string
  headers?: Record<string, string>
  queryParams?: Record<string, string>
  maxOutputTokens?: number
}

export interface NativeServiceRoute extends NativeModelRouteBase {
  kind: 'service'
  serviceKey: string
}

export interface NativeBuiltinPassthroughRoute extends NativeModelRouteBase {
  kind: 'builtin_passthrough'
  serviceKey?: undefined
}

export type NativeModelRouteDescriptor = NativeServiceRoute | NativeBuiltinPassthroughRoute

export interface NativeModelSwitchFlags {
  nativeModelSwitch: boolean
  nativeModelSwitchBootstrap: boolean
}
