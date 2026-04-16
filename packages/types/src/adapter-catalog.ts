import type { AdapterBuiltinModel } from './config'

export interface AdapterCatalogCapabilities {
  supportsEffort?: boolean
  supportsDirectRuntime?: boolean
  supportsSessionTerminal?: boolean
  supportsLiveToolProcess?: boolean
  supportsPermissionMirror?: boolean
  hookMode?: 'none' | 'task-bridge' | 'native'
  projectSkillsMode?: 'none' | 'prompt' | 'overlay' | 'native'
}

export interface AdapterCatalogEntry {
  instanceId: string
  packageId: string
  title: string
  icon?: string
  builtinModels: AdapterBuiltinModel[]
  capabilities: AdapterCatalogCapabilities
}

export interface AdapterCatalogResponse {
  adapters: AdapterCatalogEntry[]
}
