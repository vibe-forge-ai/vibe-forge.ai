import type { ManagedPluginAdapter, ManagedPluginInstallConfig, ManagedPluginSource } from './plugin'

export interface AdapterPluginAddOptions {
  cwd?: string
  source: string
  force?: boolean
  scope?: string
}

export interface AdapterPluginAddResult {
  config: ManagedPluginInstallConfig
  installDir: string
  nativePluginDir?: string
  workspacePluginDir?: string
}

export interface AdapterPluginManifest {
  name?: string
}

export interface AdapterPluginResolveSourceContext {
  cwd: string
  requestedSource: string
  tempDir: string
  installSource: (targetDir: string, source: ManagedPluginSource) => Promise<string>
}

export interface ResolvedAdapterPluginSource<
  TManifest extends AdapterPluginManifest = AdapterPluginManifest
> {
  installSource: ManagedPluginSource
  managedSource?: ManagedPluginSource
  manifestOverrides?: Partial<TManifest>
}

export interface AdapterPluginInstaller<
  TManifest extends AdapterPluginManifest = AdapterPluginManifest
> {
  adapter: ManagedPluginAdapter
  displayName?: string
  resolveSource?: (
    context: AdapterPluginResolveSourceContext
  ) => Promise<ResolvedAdapterPluginSource<TManifest> | undefined>
  parseSource?: (
    cwd: string,
    requestedSource: string
  ) => Promise<ManagedPluginSource>
  detectPluginRoot: (
    baseDir: string
  ) => Promise<string>
  readManifest?: (
    pluginRoot: string
  ) => Promise<TManifest | undefined>
  mergeManifest?: (
    manifest: TManifest | undefined,
    overrides: Partial<TManifest> | undefined
  ) => TManifest | undefined
  validateManifest?: (params: {
    manifest: TManifest | undefined
    pluginRoot: string
    requestedSource: string
  }) => Promise<void> | void
  getPluginName?: (params: {
    pluginRoot: string
    manifest: TManifest | undefined
  }) => string
  convertToVibeForge: (params: {
    nativePluginRoot: string
    vibeForgeRoot: string
    pluginName: string
    pluginDataDir: string
    manifest: TManifest | undefined
  }) => Promise<void>
  formatInstallSummary?: (params: {
    pluginName: string
    installDir: string
    nativePluginDir: string
    vibeForgePluginDir: string
  }) => string[]
}
