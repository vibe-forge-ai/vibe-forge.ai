import type { HookContext, HookInputs, HookOutputs, Plugin } from '@vibe-forge/core/hooks'

export const callPluginHook = async <K extends keyof HookInputs>(
  eventName: K,
  context: HookContext,
  input: HookInputs[K],
  plugins: Partial<Plugin>[] = []
): Promise<HookOutputs[K]> => {
  const { logger } = context
  const filterPlugins = plugins.filter(
    (
      item
    ): item is
      & {
        name?: string
      }
      & {
        [k in K]: NonNullable<Plugin[k]>
      } => !!item && !!item[eventName]
  )

  // 创建中间件链
  let index = 0

  const next = async (): Promise<HookOutputs[K]> => {
    if (index >= filterPlugins.length) {
      // 如果没有更多插件，返回默认结果
      return { continue: true }
    }

    const currentPlugin = filterPlugins[index]
    const { name = '<anonymous>', [eventName]: hook } = currentPlugin
    
    // 增加索引，防止重复调用导致死循环或错误逻辑
    index++

    const withNameLogger = {
      ...logger,
      info: logger.info.bind(logger, `[plugin.${name}]`),
      warn: logger.warn.bind(logger, `[plugin.${name}]`),
      debug: logger.debug.bind(logger, `[plugin.${name}]`),
      error: logger.error.bind(logger, `[plugin.${name}]`)
    }
    try {
      return await hook(
        {
          ...context,
          logger: withNameLogger
        },
        // @ts-ignore
        input,
        next
      )
    } catch (e) {
      if (e instanceof Error) {
        // 只有第一个插件抛出的错误才需要添加对应的插件名
        if (!e.name.includes('[plugin.')) {
          e.name = `${e.name}[plugin.${name}]`
        }
      }
      throw e
    }
  }

  return next()
}
