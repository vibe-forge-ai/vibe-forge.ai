import process from 'node:process'

import type { Command } from 'commander'

import { loadConfig, resolveServerLogLevel } from '@vibe-forge/core'
import type { AdapterCtx } from '@vibe-forge/core/adapter'
import { loadAdapter } from '@vibe-forge/core/adapter'
import { getCache, setCache } from '@vibe-forge/core/utils/cache'
import { createLogger } from '@vibe-forge/core/utils/create-logger'
import { uuid } from '@vibe-forge/core/utils/uuid'

interface InitOptions {
  force?: boolean
}

const createInitContext = async () => {
  const cwd = process.env.__VF_PROJECT_WORKSPACE_FOLDER__ ?? process.cwd()
  const ctxId = process.env.__VF_PROJECT_AI_CTX_ID__ ?? uuid()
  const env: Record<string, string | null | undefined> = {
    ...process.env,
    __VF_PROJECT_AI_CTX_ID__: ctxId,
    __VF_PROJECT_AI_RUN_TYPE__: 'cli',
    NODE_OPTIONS: undefined
  }
  const logger = createLogger(cwd, ctxId, ctxId, env.LOG_PREFIX ?? '', resolveServerLogLevel(env))
  const jsonVariables: Record<string, string | null | undefined> = {
    ...env,
    WORKSPACE_FOLDER: cwd,
    __VF_PROJECT_WORKSPACE_FOLDER__: cwd
  }
  const [config, userConfig] = await loadConfig({ jsonVariables })
  const ctx: AdapterCtx = {
    ctxId,
    cwd,
    env,
    cache: {
      set: (key, value) => setCache(cwd, ctxId, ctxId, key, value),
      get: (key) => getCache(cwd, ctxId, ctxId, key)
    },
    logger,
    configs: [config, userConfig]
  }
  return { ctx, config, userConfig }
}

export function registerInitCommand(program: Command) {
  program
    .command('init')
    .description('Init project by config')
    .option('--force', 'Force to override existing files')
    .action(async (options: InitOptions) => {
      const { ctx, config, userConfig } = await createInitContext()
      const adapterNames = new Set([
        ...Object.keys(config?.adapters ?? {}),
        ...Object.keys(userConfig?.adapters ?? {})
      ])
      if (adapterNames.size === 0) {
        console.warn('No adapter config found, skip init')
        return
      }
      let hasError = false
      for (const name of adapterNames) {
        const hasConfig = (config?.adapters != null && name in config.adapters) ||
          (userConfig?.adapters != null && name in userConfig.adapters)
        if (!hasConfig) {
          continue
        }
        try {
          const adapter = await loadAdapter(name)
          if (adapter.init) {
            await adapter.init(ctx, { force: options.force })
            console.log(`Adapter ${name} init completed`)
          } else {
            console.log(`Adapter ${name} does not support init`)
          }
        } catch (error) {
          hasError = true
          console.error(`Adapter ${name} init failed`, error)
        }
      }
      if (hasError) {
        process.exitCode = 1
      }
    })
}
