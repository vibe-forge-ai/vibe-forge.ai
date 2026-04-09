/**
 * 用户配置中的单个插件实例。
 *
 * 该结构同时用于顶层 `Config.plugins` 和 `children`。
 */
export interface PluginChildConfig {
  /**
   * npm 包名或插件简写名。
   *
   * 裸名会按 `id -> @vibe-forge/plugin-${id}` 的顺序解析。
   *
   * @example "logger"
   * @example "@acme/plugin-docs"
   */
  id: string
  /**
   * 是否启用当前插件实例。
   *
   * 默认为 `true`。设为 `false` 时，该实例不会进入当前任务的有效插件图。
   * 这个字段同样可以用于 child plugin，用来关闭默认激活的 child。
   */
  enabled?: boolean
  /**
   * 用户定义的资源命名空间。
   *
   * 如果配置了 `scope`，插件导出的资源会以 `scope/name` 的形式暴露，
   * 例如 `std/standard-dev-flow`。
   *
   * scope 完全由用户控制，插件 manifest 侧不允许声明默认 scope。
   */
  scope?: string
  /**
   * 传给插件 hooks 或 child 解析逻辑的实例级参数。
   */
  options?: Record<string, unknown>
  /**
   * 显式启用或覆写 child plugin。
   *
   * child plugin 可以来自父插件 manifest，也可以是任意已安装依赖。
   * child 未显式设置 `scope` 时，会继承父实例的 `scope`。
   */
  children?: PluginChildConfig[]
}

export interface PluginInstanceConfig extends PluginChildConfig {}

/**
 * 项目级或用户级的插件实例列表。
 *
 * project config 与 user config 会按数组顺序拼接。
 */
export type PluginConfig = PluginInstanceConfig[]

/**
 * `spec` / `entity` 级别的插件覆盖配置。
 *
 * 这层覆盖只作用于当前任务，不会回写项目配置。
 */
export interface PluginOverlayConfig {
  /**
   * `extend` 会在项目有效插件列表后追加 `list`；
   * `override` 会直接用 `list` 替换项目有效插件列表。
   */
  mode: 'extend' | 'override'
  /**
   * 参与当前任务覆盖的插件实例列表。
   */
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

/**
 * 插件包 root export 暴露的 manifest。
 *
 * manifest 只描述包内资产和 child plugin 元数据，不允许声明 `scope`。
 */
export interface PluginManifest {
  __vibeForgePluginManifest?: true
  assets?: PluginManifestAssets
  children?: Record<string, PluginManifestChildDefinition>
}

export type ManagedPluginAdapter = 'claude'

export interface ManagedPluginNpmSource {
  type: 'npm'
  spec: string
}

export interface ManagedPluginGithubSource {
  type: 'github'
  repo: string
  ref?: string
}

export interface ManagedPluginGitSource {
  type: 'git'
  url: string
  ref?: string
}

export interface ManagedPluginPathSource {
  type: 'path'
  path: string
}

export type ManagedPluginSource =
  | ManagedPluginNpmSource
  | ManagedPluginGithubSource
  | ManagedPluginGitSource
  | ManagedPluginPathSource

export interface ManagedPluginInstallConfig {
  version: 1
  adapter: ManagedPluginAdapter
  name: string
  scope?: string
  installedAt: string
  source: ManagedPluginSource
  nativePluginPath: string
  vibeForgePluginPath: string
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
