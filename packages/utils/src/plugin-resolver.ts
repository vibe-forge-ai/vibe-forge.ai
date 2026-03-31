import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

import type {
  PluginChildConfig,
  PluginConfig,
  PluginInstanceConfig,
  PluginManifest,
  PluginManifestChildDefinition
} from '@vibe-forge/types'

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const normalizeOptions = (value: unknown): Record<string, unknown> => (
  isRecord(value) ? value : {}
)

const createWorkspaceRequire = (cwd: string) => createRequire(resolve(cwd, '__vibe_forge_plugin_loader__.cjs'))

const shouldTryPrefixedPackageId = (id: string) => (
  !id.startsWith('@') &&
  !id.startsWith('.') &&
  !id.startsWith('/') &&
  !id.includes('\\')
)

const toPluginManifest = (value: unknown): PluginManifest | undefined => {
  if (!isRecord(value)) return undefined

  const manifestLike = value.__vibeForgePluginManifest === true || 'assets' in value || 'children' in value || 'scope' in value
  if (!manifestLike) return undefined

  if ('scope' in value) {
    throw new Error('Plugin manifests must not define scope. Scope is controlled by user config.')
  }

  return {
    __vibeForgePluginManifest: true,
    assets: isRecord(value.assets)
      ? Object.fromEntries(
        Object.entries(value.assets).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim() !== ''
        )
      ) as PluginManifest['assets']
      : undefined,
    children: isRecord(value.children)
      ? Object.fromEntries(
        Object.entries(value.children).map(([key, child]) => {
          if (!isRecord(child)) {
            throw new Error(`Invalid child plugin definition for ${key}`)
          }
          const source = child.source
          if (!isRecord(source) || (source.type !== 'package' && source.type !== 'directory')) {
            throw new Error(`Invalid child plugin source for ${key}`)
          }
          if (typeof child.activation !== 'string' || (child.activation !== 'default' && child.activation !== 'optional')) {
            throw new Error(`Invalid child plugin activation for ${key}`)
          }
          if ('scope' in child) {
            throw new Error(`Child plugin ${key} must not define scope in manifest.`)
          }
          return [
            key,
            {
              source: source.type === 'package'
                ? { type: 'package', id: String(source.id) }
                : { type: 'directory', path: String(source.path) },
              activation: child.activation,
              options: normalizeOptions(child.options)
            } satisfies PluginManifestChildDefinition
          ]
        })
      )
      : undefined
  }
}

export interface ResolvedPluginReference {
  sourceType: 'package' | 'directory'
  requestId: string
  packageId?: string
  resolvedBy: 'direct' | 'vibe-forge-prefix' | 'manifest-package' | 'manifest-directory' | 'directory-fallback'
  rootDir: string
}

export interface ResolvedPluginInstance {
  requestId: string
  packageId?: string
  sourceType: 'package' | 'directory'
  rootDir: string
  scope?: string
  options: Record<string, unknown>
  manifest?: PluginManifest
  instancePath: string
  resolvedBy: ResolvedPluginReference['resolvedBy']
  overlaySource?: string
  childDefinitions: Record<string, PluginManifestChildDefinition>
  children: ResolvedPluginInstance[]
}

const normalizeScope = (value: unknown) => (
  typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : undefined
)

const normalizePluginInstanceConfig = (
  value: unknown,
  path: string
): PluginInstanceConfig => {
  if (!isRecord(value)) {
    throw new Error(`Invalid plugin instance at ${path}. Expected an object.`)
  }

  const id = typeof value.id === 'string' && value.id.trim() !== ''
    ? value.id.trim()
    : undefined
  if (id == null) {
    throw new Error(`Invalid plugin instance at ${path}. "id" must be a non-empty string.`)
  }

  if ('options' in value && value.options != null && !isRecord(value.options)) {
    throw new Error(`Invalid plugin instance at ${path}. "options" must be an object.`)
  }
  if ('children' in value && value.children != null && !Array.isArray(value.children)) {
    throw new Error(`Invalid plugin instance at ${path}. "children" must be an array.`)
  }

  const children = Array.isArray(value.children)
    ? value.children.map((child, index) => normalizePluginInstanceConfig(child, `${path}.children[${index}]`))
    : undefined

  return {
    id,
    ...(normalizeScope(value.scope) != null ? { scope: normalizeScope(value.scope) } : {}),
    ...(isRecord(value.options) ? { options: value.options } : {}),
    ...(children != null ? { children } : {})
  }
}

export const normalizePluginConfig = (
  plugins: PluginConfig | undefined,
  path: string = 'plugins'
): PluginConfig | undefined => {
  if (plugins == null) return undefined
  if (!Array.isArray(plugins)) {
    throw new Error(`Invalid ${path} config. "plugins" must be an array of plugin instances; the legacy object map format is no longer supported.`)
  }

  return plugins.map((plugin, index) => normalizePluginInstanceConfig(plugin, `${path}[${index}]`))
}

const resolvePackageReference = (cwd: string, id: string): ResolvedPluginReference => {
  const workspaceRequire = createWorkspaceRequire(cwd)
  const candidates = shouldTryPrefixedPackageId(id)
    ? [id, `@vibe-forge/plugin-${id}`]
    : [id]

  for (const candidate of candidates) {
    try {
      const packageJsonPath = workspaceRequire.resolve(`${candidate}/package.json`)
      return {
        sourceType: 'package',
        requestId: id,
        packageId: candidate,
        resolvedBy: candidate === id ? 'direct' : 'vibe-forge-prefix',
        rootDir: dirname(packageJsonPath)
      }
    } catch {
    }
  }

  throw new Error(`Failed to resolve plugin package ${id}. Install it in the current workspace first.`)
}

const loadManifest = (
  cwd: string,
  packageId: string
) => {
  const workspaceRequire = createWorkspaceRequire(cwd)
  try {
    // eslint-disable-next-line ts/no-require-imports
    const mod = workspaceRequire(packageId)
    return toPluginManifest(mod?.default ?? mod)
  } catch {
    return undefined
  }
}

const resolveDirectoryPath = (baseDir: string, path: string) => (
  path.startsWith('/') ? path : resolve(baseDir, path)
)

const collectFallbackDirectoryChildren = async (rootDir: string) => {
  const pluginsDir = resolve(rootDir, 'plugins')
  if (!existsSync(pluginsDir)) return {} as Record<string, PluginManifestChildDefinition>

  const entries = await readdir(pluginsDir, { withFileTypes: true })
  return Object.fromEntries(
    entries
      .filter(entry => entry.isDirectory())
      .map(entry => [
        entry.name,
        {
          source: {
            type: 'directory',
            path: resolve(pluginsDir, entry.name)
          },
          activation: 'optional',
          options: {}
        } satisfies PluginManifestChildDefinition
      ])
  )
}

const collectChildDefinitions = async (
  rootDir: string,
  manifest: PluginManifest | undefined
) => ({
  ...(manifest?.children ?? {}),
  ...await collectFallbackDirectoryChildren(rootDir)
})

const mergeOptions = (
  baseOptions: Record<string, unknown> | undefined,
  overrideOptions: Record<string, unknown> | undefined
) => ({
  ...(baseOptions ?? {}),
  ...(overrideOptions ?? {})
})

const hasExplicitChildOverride = (children: PluginChildConfig[], childId: string) => (
  children.some(child => child.id === childId)
)

const resolveChildReference = (
  cwd: string,
  parent: ResolvedPluginInstance,
  childConfig: PluginChildConfig
): {
    reference: ResolvedPluginReference
    manifestChild?: PluginManifestChildDefinition
  } => {
  const manifestChild = parent.childDefinitions[childConfig.id]
  if (manifestChild == null) {
    return {
      reference: resolvePackageReference(cwd, childConfig.id)
    }
  }

  if (manifestChild.source.type === 'package') {
    const reference = resolvePackageReference(cwd, manifestChild.source.id)
    return {
      reference: {
        ...reference,
        requestId: childConfig.id,
        resolvedBy: 'manifest-package'
      },
      manifestChild
    }
  }

  return {
    reference: {
      sourceType: 'directory',
      requestId: childConfig.id,
      resolvedBy: 'manifest-directory',
      rootDir: resolveDirectoryPath(parent.rootDir, manifestChild.source.path)
    },
    manifestChild
  }
}

const resolveTopLevelReference = (
  cwd: string,
  config: PluginInstanceConfig
) => resolvePackageReference(cwd, config.id)

interface ResolvePluginInstanceParams {
  cwd: string
  config: PluginInstanceConfig | PluginChildConfig
  instancePath: string
  overlaySource?: string
  inheritedScope?: string
  parent?: ResolvedPluginInstance
  ancestorKeys?: string[]
}

const resolveInstance = async (
  params: ResolvePluginInstanceParams
): Promise<ResolvedPluginInstance> => {
  const {
    cwd,
    config,
    instancePath,
    overlaySource,
    inheritedScope,
    parent,
    ancestorKeys = []
  } = params

  const {
    reference,
    manifestChild
  } = parent == null
    ? { reference: resolveTopLevelReference(cwd, config as PluginInstanceConfig), manifestChild: undefined }
    : resolveChildReference(cwd, parent, config)

  const cycleKey = `${reference.sourceType}:${reference.packageId ?? reference.rootDir}`
  if (ancestorKeys.includes(cycleKey)) {
    throw new Error(`Detected cyclic child plugin graph at ${config.id}`)
  }

  const manifest = reference.packageId != null ? loadManifest(cwd, reference.packageId) : undefined
  const childDefinitions = await collectChildDefinitions(reference.rootDir, manifest)
  const scope = config.scope ?? inheritedScope
  const options = mergeOptions(
    manifestChild?.options,
    normalizeOptions(config.options)
  )

  const explicitChildren = config.children ?? []
  const autoChildren: PluginChildConfig[] = Object.entries(childDefinitions)
    .filter(([childId, child]) => child.activation === 'default' && !hasExplicitChildOverride(explicitChildren, childId))
    .map(([childId, child]) => ({
      id: childId,
      options: child.options
    }))

  const childConfigs = [
    ...explicitChildren,
    ...autoChildren
  ]

  const nextAncestorKeys = [...ancestorKeys, cycleKey]
  const children: ResolvedPluginInstance[] = []
  for (let index = 0; index < childConfigs.length; index++) {
    const child = childConfigs[index]
    children.push(await resolveInstance({
      cwd,
      config: child,
      instancePath: `${instancePath}.children.${index}`,
      overlaySource,
      inheritedScope: scope,
      parent: {
        requestId: config.id,
        packageId: reference.packageId,
        sourceType: reference.sourceType,
        rootDir: reference.rootDir,
        scope,
        options,
        manifest,
        instancePath,
        resolvedBy: reference.resolvedBy,
        overlaySource,
        childDefinitions,
        children: []
      },
      ancestorKeys: nextAncestorKeys
    }))
  }

  return {
    requestId: config.id,
    packageId: reference.packageId,
    sourceType: reference.sourceType,
    rootDir: reference.rootDir,
    scope,
    options,
    manifest,
    instancePath,
    resolvedBy: reference.resolvedBy,
    overlaySource,
    childDefinitions,
    children
  }
}

export const flattenPluginInstances = (plugins: ResolvedPluginInstance[]): ResolvedPluginInstance[] => (
  plugins.flatMap(plugin => [plugin, ...flattenPluginInstances(plugin.children)])
)

export const mergePluginConfigs = (
  projectPlugins: PluginConfig | undefined,
  userPlugins: PluginConfig | undefined
): PluginConfig | undefined => {
  const merged = [
    ...(normalizePluginConfig(projectPlugins, 'project.plugins') ?? []),
    ...(normalizePluginConfig(userPlugins, 'user.plugins') ?? [])
  ]
  return merged.length > 0 ? merged : undefined
}

export const resolveConfiguredPluginInstances = async (params: {
  cwd: string
  plugins?: PluginConfig
  overlaySource?: string
}) => {
  const pluginConfigs = normalizePluginConfig(
    params.plugins,
    params.overlaySource != null ? `${params.overlaySource}.plugins` : 'plugins'
  )
  const instances: ResolvedPluginInstance[] = []
  for (let index = 0; index < (pluginConfigs ?? []).length; index++) {
    instances.push(await resolveInstance({
      cwd: params.cwd,
      config: pluginConfigs![index],
      instancePath: String(index),
      overlaySource: params.overlaySource
    }))
  }
  return instances
}
