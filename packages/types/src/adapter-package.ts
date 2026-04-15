import { dirname, join } from 'node:path'

import type { Adapter } from './adapter'
import type { AdapterPluginInstaller } from './native-plugin'

const ADAPTER_SCOPE = '@vibe-forge'
const ADAPTER_PREFIX = 'adapter-'
const ADAPTER_PLUGIN_EXPORT = '/plugins'

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
