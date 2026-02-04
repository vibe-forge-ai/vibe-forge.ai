import process from 'node:process'

import { loadConfig } from '@vibe-forge/core'
import type { HookOutputCore } from '@vibe-forge/core/hooks'
import { resolvePlugins } from '@vibe-forge/core/hooks'
import { createLogger } from '@vibe-forge/core/utils/create-logger'

import { hookInput, setHookInput } from './hook-input'
import { callPluginHook } from './plugins'

void (async function main() {
  try {
    await setHookInput()

    const {
      __VF_PROJECT_WORKSPACE_FOLDER__: workspaceFolder = process.env.HOME ?? '/',
      __VF_PROJECT_AI_CTX_ID__: ctxId = 'default',
      __VF_PROJECT_AI_LOG_PREFIX__: logPrefix = ''
    } = process.env

    const { sessionId, hookEventName } = hookInput

    const _logger = createLogger(workspaceFolder, ctxId, sessionId, logPrefix)

    const logger: typeof _logger = {
      ..._logger,
      info: (...args) => _logger.info(`[${hookEventName}]`, ...args),
      warn: (...args) => _logger.warn(`[${hookEventName}]`, ...args),
      debug: (...args) => _logger.debug(`[${hookEventName}]`, ...args),
      error: (...args) => _logger.error(`[${hookEventName}]`, ...args)
    }

    const [config, userConfig] = await loadConfig({})
    const plugins = [
      ...await resolvePlugins(config?.plugins ?? []),
      ...await resolvePlugins(userConfig?.plugins ?? [])
    ]

    const res = await callPluginHook(
      hookInput.hookEventName,
      { logger },
      hookInput,
      plugins
    )
    console.log(JSON.stringify(res))
  } catch (e) {
    console.log(
      JSON.stringify({
        continue: false,
        stopReason: `run hook error: ${String(e)}`
      } as HookOutputCore)
    )
  }
})()
