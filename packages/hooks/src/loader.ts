import type { PluginConfig } from '@vibe-forge/types'
import { flattenPluginInstances, resolveConfiguredPluginInstances } from '@vibe-forge/utils/plugin-resolver'

import type { Plugin } from './context'

const loadPlugin = async (
  name: string,
  config: Record<string, unknown>
): Promise<Partial<Plugin> | null> => {
  try {
    // eslint-disable-next-line ts/no-require-imports
    const module = require(`${name}/hooks`)
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
  if ((config?.length ?? 0) === 0) return []

  const instances = flattenPluginInstances(
    await resolveConfiguredPluginInstances({
      cwd,
      plugins: config
    })
  ).filter(instance => instance.packageId != null)

  const modules = await Promise.allSettled(
    instances.map(instance => loadPlugin(instance.packageId!, instance.options))
  )

  const plugins: Partial<Plugin>[] = []
  modules.forEach((result, index) => {
    const pkgName = instances[index].packageId ?? instances[index].requestId
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
