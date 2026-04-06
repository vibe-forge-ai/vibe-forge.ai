import { Buffer } from 'node:buffer'
import process from 'node:process'

import { buildConfigJsonVariables, loadConfig, resetConfigCache } from '@vibe-forge/config'
import { createLogger } from '@vibe-forge/utils/create-logger'
import { resolveServerLogLevel } from '@vibe-forge/utils/log-level'
import { transformCamelKey } from '@vibe-forge/utils/string-transform'

import { createBuiltinPermissionPlugin } from './builtin-permissions'
import type { HookContext, Plugin } from './context'
import { resolvePlugins } from './loader'
import type { HookInput, HookInputs, HookOutputCore, HookOutputs } from './type'

export const callPluginHook = async <K extends keyof HookInputs>(
  eventName: K,
  context: HookContext,
  input: HookInputs[K],
  plugins: Partial<Plugin>[] = []
): Promise<HookOutputs[K]> => {
  const { logger } = context
  const filteredPlugins = plugins.filter(
    (
      item
    ): item is
      & {
        name?: string
      }
      & {
        [P in K]: NonNullable<Plugin[P]>
      } => !!item && !!item[eventName]
  )

  let index = 0

  const next = async (): Promise<HookOutputs[K]> => {
    if (index >= filteredPlugins.length) {
      return { continue: true }
    }

    const currentPlugin = filteredPlugins[index]
    const name = currentPlugin.name ?? '<anonymous>'
    const hook = currentPlugin[eventName] as (
      ctx: HookContext,
      input: HookInputs[K],
      next: () => Promise<HookOutputs[K]>
    ) => Promise<HookOutputs[K]>
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
        input,
        next
      )
    } catch (error) {
      if (error instanceof Error && !error.name.includes('[plugin.')) {
        error.name = `${error.name}[plugin.${name}]`
      }
      throw error
    }
  }

  return next()
}

export const executeHookInput = async (
  input: HookInput,
  env: Record<string, string | null | undefined> = process.env
) => {
  const workspaceFolder = env.__VF_PROJECT_WORKSPACE_FOLDER__ ?? input.cwd ?? process.env.HOME ?? '/'
  const ctxId = env.__VF_PROJECT_AI_CTX_ID__ ?? input.sessionId ?? 'default'
  const logPrefix = env.__VF_PROJECT_AI_LOG_PREFIX__ ?? ''
  const loggerBase = createLogger(
    workspaceFolder,
    ctxId,
    input.sessionId,
    logPrefix,
    resolveServerLogLevel(env)
  )

  const logger: typeof loggerBase = {
    ...loggerBase,
    info: (...args) => loggerBase.info(`[${input.hookEventName}]`, ...args),
    warn: (...args) => loggerBase.warn(`[${input.hookEventName}]`, ...args),
    debug: (...args) => loggerBase.debug(`[${input.hookEventName}]`, ...args),
    error: (...args) => loggerBase.error(`[${input.hookEventName}]`, ...args)
  }

  resetConfigCache(workspaceFolder)
  const jsonVariables = buildConfigJsonVariables(workspaceFolder, env)
  const [config, userConfig] = await loadConfig({
    cwd: workspaceFolder,
    jsonVariables
  })
  const plugins = [
    createBuiltinPermissionPlugin(env),
    ...await resolvePlugins(workspaceFolder, config?.plugins),
    ...await resolvePlugins(workspaceFolder, userConfig?.plugins)
  ]

  return callPluginHook(
    input.hookEventName as keyof HookInputs,
    { logger },
    input as never,
    plugins
  )
}

export const readHookInput = async () => {
  const stdoutBuffer = await new Promise<Buffer>((resolve) => {
    const chunks: Buffer[] = []
    process.stdin.on('data', chunk => chunks.push(chunk))
    process.stdin.once('end', () => resolve(Buffer.concat(chunks)))
  })

  return transformCamelKey<HookInput>(
    JSON.parse(stdoutBuffer.toString() || '{}')
  )
}

export const runHookCli = async () => {
  try {
    const input = await readHookInput()
    const result = await executeHookInput(input)
    process.stdout.write(`${JSON.stringify(result)}\n`)
  } catch (error) {
    process.stdout.write(
      `${
        JSON.stringify(
          {
            continue: false,
            stopReason: `run hook error: ${String(error)}`
          } satisfies HookOutputCore
        )
      }\n`
    )
  }
}
