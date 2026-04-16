import type { AdapterCatalogCapabilities } from './adapter-catalog'
import type { AdapterBuiltinModel } from './config'
import type { ToolPresentationInput, ToolViewEnvelope } from './tool-view'

export interface AdapterManifest {
  packageId: string
  title: string
  icon?: string
  builtinModels?: AdapterBuiltinModel[]
  capabilities: AdapterCatalogCapabilities
  toolNamespaces?: string[]
}

export interface ToolPresentationProvider {
  matches: (input: ToolPresentationInput) => boolean
  build: (input: ToolPresentationInput) => ToolViewEnvelope | undefined
}
