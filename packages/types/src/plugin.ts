export interface PluginChildConfig {
  id: string
  enabled?: boolean
  scope?: string
  options?: Record<string, unknown>
  children?: PluginChildConfig[]
}

export interface PluginInstanceConfig extends PluginChildConfig {}

export type PluginConfig = PluginInstanceConfig[]

export interface PluginOverlayConfig {
  mode: 'extend' | 'override'
  list: PluginInstanceConfig[]
}

export interface PluginManifestAssets {
  rules?: string
  skills?: string
  specs?: string
  entities?: string
  mcp?: string
}

export interface PluginManifestChildSourcePackage {
  type: 'package'
  id: string
}

export interface PluginManifestChildSourceDirectory {
  type: 'directory'
  path: string
}

export interface PluginManifestChildDefinition {
  source: PluginManifestChildSourcePackage | PluginManifestChildSourceDirectory
  activation: 'default' | 'optional'
  options?: Record<string, unknown>
}

export interface PluginManifest {
  __vibeForgePluginManifest?: true
  assets?: PluginManifestAssets
  children?: Record<string, PluginManifestChildDefinition>
}

export type PluginResolutionStrategy =
  | 'direct'
  | 'vibe-forge-prefix'
  | 'manifest-package'
  | 'manifest-directory'
  | 'directory-fallback'

export interface ResolvedPluginInstanceMetadata {
  requestId: string
  packageId?: string
  sourceType: 'package' | 'directory'
  rootDir: string
  scope?: string
  options: Record<string, unknown>
  instancePath: string
  resolvedBy: PluginResolutionStrategy
  overlaySource?: string
  children: ResolvedPluginInstanceMetadata[]
}

export const definePluginManifest = (
  manifest: Omit<PluginManifest, '__vibeForgePluginManifest'>
): PluginManifest => ({
  ...manifest,
  __vibeForgePluginManifest: true
})
