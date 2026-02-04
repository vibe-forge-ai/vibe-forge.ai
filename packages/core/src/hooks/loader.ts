import type { Plugin, PluginConfig } from './index'

/**
 * 解析单个插件配置
 */
const loadPlugin = async (
  name: string,
  config: Record<string, unknown>
): Promise<Partial<Plugin> | null> => {
  try {
    // eslint-disable-next-line ts/no-require-imports
    const module = require(`${name}/hooks`)

    // 兼容 ESM default export 和 CJS module.exports
    const factory: (
      // 直接导出插件对象
      | Partial<Plugin>
      // 导出工厂函数，接受配置并返回插件对象
      | ((config: Record<string, unknown>) => Partial<Plugin>)
    ) = module.default ?? module

    if (typeof factory === 'function') {
      // TODO: 这里可以注入更多上下文，如全局配置、版本信息等
      return factory(config)
    } else if (typeof factory === 'object' && factory !== null) {
      return factory
    }

    console.warn(`Plugin ${name} does not export a valid plugin factory or object.`)
    return null
  } catch (e) {
    console.error(`Failed to load plugin ${name}:`, e)
    return null
  }
}

export const resolvePlugins = async (config: PluginConfig): Promise<Partial<Plugin>[]> => {
  // 1. 处理数组形式配置 (直接实例化或函数调用)
  if (Array.isArray(config)) {
    return config.map((p) => (typeof p === 'function' ? p() : p))
  }

  // 2. 处理对象形式配置 (动态加载)
  const entries = Object.entries(config)
  if (entries.length === 0) return []

  // 并行加载所有插件
  const modules = await Promise.allSettled(
    entries.map(([pkgName, pkgConfig]) => {
      // 如果不是以 @ 或 @vibe-forge/plugin- 开头，则默认加上 @vibe-forge/plugin- 前缀
      const resolvedName = pkgName.startsWith('@') ? pkgName : `@vibe-forge/plugin-${pkgName}`
      // dprint-ignore
      return (
        loadPlugin(resolvedName, pkgConfig as Record<string, unknown>) ??
        loadPlugin(pkgName, pkgConfig as Record<string, unknown>)
      )
    })
  )

  // 收集成功加载的插件
  const plugins: Partial<Plugin>[] = []

  modules.forEach((result, index) => {
    const pkgName = entries[index][0]
    if (result.status === 'fulfilled') {
      if (result.value) {
        plugins.push(result.value)
      }
    } else {
      console.error(`Error loading plugin ${pkgName}:`, result.reason)
    }
  })

  return plugins
}
