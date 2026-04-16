import { dirname, join } from 'node:path'

import type { AdapterCatalogCapabilities } from './adapter-catalog'
import type { Adapter } from './adapter'
import type { AdapterManifest, ToolPresentationProvider } from './adapter-manifest'
import type { AdapterBuiltinModel, AdapterConfigMap } from './config'
import type { AdapterPluginInstaller } from './native-plugin'

const ADAPTER_SCOPE = '@vibe-forge'
const ADAPTER_PREFIX = 'adapter-'
const ADAPTER_PLUGIN_EXPORT = '/plugins'
const ADAPTER_MANIFEST_EXPORT = '/manifest'
const ADAPTER_PRESENTATION_EXPORT = '/presentation'

const EFFORT_ADAPTERS = new Set(['claude-code', 'codex', 'copilot', 'kimi', 'opencode'])
const DIRECT_RUNTIME_ADAPTERS = new Set(['codex'])
const SESSION_TERMINAL_ADAPTERS = new Set(['codex', 'copilot', 'opencode'])
const PERMISSION_MIRROR_ADAPTERS = new Set(['claude-code', 'kimi', 'opencode'])
const NATIVE_PROJECT_SKILL_ADAPTERS = new Set(['claude-code', 'copilot', 'gemini', 'kimi', 'opencode'])
const NATIVE_HOOK_ADAPTERS = new Set(['claude-code', 'codex', 'kimi', 'opencode'])
const TASK_BRIDGE_HOOK_ADAPTERS = new Set(['copilot', 'gemini'])

const loadWorkspacePackageExport = (params: {
  packageName: string
  sourcePath: string
}) => {
  const packageJsonPath = require.resolve(`${params.packageName}/package.json`)
  return (
    // eslint-disable-next-line ts/no-require-imports
    require(join(dirname(packageJsonPath), params.sourcePath))
  )
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const isNonEmptyString = (value: unknown): value is string => (
  typeof value === 'string' && value.trim() !== ''
)

const isMissingExportError = (error: unknown, exportName: string) => {
  const code = (error as NodeJS.ErrnoException | undefined)?.code
  const message = error instanceof Error ? error.message : String(error)
  return (
    code === 'ERR_PACKAGE_PATH_NOT_EXPORTED' ||
    (code === 'MODULE_NOT_FOUND' && message.includes(exportName))
  )
}

export const normalizeAdapterPackageId = (type: string) => {
  const trimmed = type.trim()
  if (trimmed.startsWith('@')) return trimmed

  const hasAdapterPrefix = trimmed.startsWith(ADAPTER_PREFIX)
  const adapterId = hasAdapterPrefix ? trimmed.slice(ADAPTER_PREFIX.length) : trimmed
  const normalizedAdapterId = adapterId === 'claude' ? 'claude-code' : adapterId

  return hasAdapterPrefix ? `${ADAPTER_PREFIX}${normalizedAdapterId}` : normalizedAdapterId
}

export const resolveAdapterPackageName = (type: string) => {
  const normalizedType = normalizeAdapterPackageId(type)
  if (normalizedType.startsWith('@')) return normalizedType
  return normalizedType.startsWith(ADAPTER_PREFIX)
    ? `${ADAPTER_SCOPE}/${normalizedType}`
    : `${ADAPTER_SCOPE}/${ADAPTER_PREFIX}${normalizedType}`
}

export const resolveAdapterPackageNameForConfigEntry = (
  instanceId: string,
  config?: AdapterConfigMap[string] | Record<string, unknown>
) => {
  const configuredPackageId = isRecord(config) && isNonEmptyString(config.packageId)
    ? config.packageId.trim()
    : instanceId
  return resolveAdapterPackageName(configuredPackageId)
}

export const loadAdapter = async (type: string) => {
  const packageName = resolveAdapterPackageName(type)

  try {
    return (
      // eslint-disable-next-line ts/no-require-imports
      require(packageName)
    ).default as Adapter
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code
    const message = error instanceof Error ? error.message : String(error)
    if (code === 'MODULE_NOT_FOUND' && message.includes('/dist/')) {
      return loadWorkspacePackageExport({
        packageName,
        sourcePath: 'src/index.ts'
      }).default as Adapter
    }
    throw error
  }
}

const tryLoadAdapterExport = <T>(params: {
  packageName: string
  exportName: string
  sourcePath: string
}): T | undefined => {
  try {
    // eslint-disable-next-line ts/no-require-imports
    return require(params.exportName) as T
  } catch (error) {
    if (isMissingExportError(error, params.exportName)) {
      return undefined
    }

    const code = (error as NodeJS.ErrnoException | undefined)?.code
    const message = error instanceof Error ? error.message : String(error)
    if (code === 'MODULE_NOT_FOUND' && message.includes('/dist/')) {
      try {
        return loadWorkspacePackageExport({
          packageName: params.packageName,
          sourcePath: params.sourcePath
        }) as T
      } catch (sourceError) {
        if (isMissingExportError(sourceError, params.sourcePath)) {
          return undefined
        }
        throw sourceError
      }
    }

    throw error
  }
}

const loadAdapterIconModule = (packageName: string) => {
  return tryLoadAdapterExport<{
    adapterIcon?: string
    adapterDisplayName?: string
  }>({
    packageName,
    exportName: `${packageName}/icon`,
    sourcePath: 'src/icon.ts'
  })
}

const loadAdapterModelsModule = (packageName: string) => {
  return tryLoadAdapterExport<{
    builtinModels?: AdapterBuiltinModel[]
  }>({
    packageName,
    exportName: `${packageName}/models`,
    sourcePath: 'src/models.ts'
  })
}

const buildFallbackCapabilities = (packageName: string): AdapterCatalogCapabilities => {
  const normalizedPackageId = normalizeAdapterPackageId(packageName)
  const adapterId = normalizedPackageId.startsWith('@')
    ? normalizedPackageId.split('/').at(-1)?.replace(/^adapter-/, '') ?? normalizedPackageId
    : normalizedPackageId.replace(/^adapter-/, '')

  return {
    supportsEffort: EFFORT_ADAPTERS.has(adapterId),
    supportsDirectRuntime: DIRECT_RUNTIME_ADAPTERS.has(adapterId),
    supportsSessionTerminal: SESSION_TERMINAL_ADAPTERS.has(adapterId),
    supportsLiveToolProcess: false,
    supportsPermissionMirror: PERMISSION_MIRROR_ADAPTERS.has(adapterId),
    hookMode: NATIVE_HOOK_ADAPTERS.has(adapterId)
      ? 'native'
      : TASK_BRIDGE_HOOK_ADAPTERS.has(adapterId)
      ? 'task-bridge'
      : 'none',
    projectSkillsMode: NATIVE_PROJECT_SKILL_ADAPTERS.has(adapterId) ? 'native' : 'prompt'
  }
}

export const loadAdapterManifest = (
  instanceId: string,
  config?: AdapterConfigMap[string] | Record<string, unknown>
): AdapterManifest => {
  const packageName = resolveAdapterPackageNameForConfigEntry(instanceId, config)
  const exportName = `${packageName}${ADAPTER_MANIFEST_EXPORT}`
  const manifestModule = tryLoadAdapterExport<AdapterManifest | { default?: AdapterManifest }>({
    packageName,
    exportName,
    sourcePath: 'src/manifest.ts'
  })

  const manifest = isRecord(manifestModule) && isRecord(manifestModule.default)
    ? manifestModule.default as AdapterManifest
    : manifestModule as AdapterManifest | undefined

  if (manifest != null) {
    return manifest
  }

  const iconModule = loadAdapterIconModule(packageName)
  const modelsModule = loadAdapterModelsModule(packageName)

  return {
    packageId: packageName,
    title: iconModule?.adapterDisplayName ?? instanceId,
    icon: iconModule?.adapterIcon,
    builtinModels: Array.isArray(modelsModule?.builtinModels) ? modelsModule.builtinModels : [],
    capabilities: buildFallbackCapabilities(packageName)
  }
}

export const loadAdapterPresentationProviders = (
  instanceId: string,
  config?: AdapterConfigMap[string] | Record<string, unknown>
): ToolPresentationProvider[] => {
  const packageName = resolveAdapterPackageNameForConfigEntry(instanceId, config)
  const exportName = `${packageName}${ADAPTER_PRESENTATION_EXPORT}`
  const presentationModule = tryLoadAdapterExport<
    ToolPresentationProvider[] | { default?: ToolPresentationProvider[] }
  >({
    packageName,
    exportName,
    sourcePath: 'src/presentation.ts'
  })

  const providers = Array.isArray(presentationModule)
    ? presentationModule
    : Array.isArray(presentationModule?.default)
    ? presentationModule.default
    : []

  return providers
}

export const loadAdapterPluginInstaller = async (type: string) => {
  const packageName = resolveAdapterPackageName(type)
  const exportName = `${packageName}${ADAPTER_PLUGIN_EXPORT}`

  try {
    return (
      // eslint-disable-next-line ts/no-require-imports
      require(exportName)
    ).default as AdapterPluginInstaller
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code
    const message = error instanceof Error ? error.message : String(error)
    if (
      code === 'ERR_PACKAGE_PATH_NOT_EXPORTED' ||
      (code === 'MODULE_NOT_FOUND' && message.includes(exportName))
    ) {
      throw new Error(`Adapter ${type} does not support native plugin management.`)
    }
    if (code === 'MODULE_NOT_FOUND' && message.includes('/dist/')) {
      return loadWorkspacePackageExport({
        packageName,
        sourcePath: 'src/plugins/index.ts'
      }).default as AdapterPluginInstaller
    }
    throw error
  }
}
