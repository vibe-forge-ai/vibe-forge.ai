import type { PluginConfig } from '@vibe-forge/types'
import {
  flattenPluginInstances,
  mergePluginConfigs,
  resolvePluginHooksEntryPathForInstance,
  resolveConfiguredPluginInstances
} from '@vibe-forge/utils/plugin-resolver'
import {
  listManagedPluginInstalls,
  toManagedPluginConfig
} from '@vibe-forge/utils/managed-plugin'
import type { Plugin } from './context'

const loadPlugin = async (
  entryPath: string,
  name: string,
  config: Record<string, unknown>
): Promise<Partial<Plugin> | null> => {
  try {
    // eslint-disable-next-line ts/no-require-imports
    const module = require(entryPath)
    const factory:
      | Partial<Plugin>
      | ((config: Record<string, unknown>) => Partial<Plugin>) = module.default ?? module

    if (typeof factory === 'function') {
      return factory(config)
    }
    if (typeof factory === 'object' && factory !== null) {
      return factory
    }

    console.warn(`Plugin ${name} does not export a valid plugin factory or object.`)
    return null
  } catch (error) {
    console.error(`Failed to load plugin ${name}:`, error)
    return null
  }
}

export const resolvePlugins = async (
  cwd: string,
  config: PluginConfig | undefined
): Promise<Partial<Plugin>[]> => {
  const managedPlugins = toManagedPluginConfig(await listManagedPluginInstalls(cwd))
  const effectiveConfig = mergePluginConfigs(config, managedPlugins) ?? []
  if (effectiveConfig.length === 0) return []

  const instances = flattenPluginInstances(
    await resolveConfiguredPluginInstances({
      cwd,
      plugins: effectiveConfig
    })
  ).flatMap((instance) => {
    const hooksEntryPath = resolvePluginHooksEntryPathForInstance(cwd, instance)
    return hooksEntryPath != null
      ? [{ instance, hooksEntryPath }]
      : []
  })

  const modules = await Promise.allSettled(
    instances.map(({ instance, hooksEntryPath }) =>
      loadPlugin(hooksEntryPath, instance.packageId ?? instance.requestId, instance.options)
    )
  )

  const plugins: Partial<Plugin>[] = []
  modules.forEach((result, index) => {
    const pkgName = instances[index]?.instance.packageId ?? instances[index]?.instance.requestId
    if (result.status === 'fulfilled') {
      if (result.value != null) {
        plugins.push(result.value)
      }
      return
    }
    console.error(`Error loading plugin ${pkgName}:`, result.reason)
  })

  return plugins
}
