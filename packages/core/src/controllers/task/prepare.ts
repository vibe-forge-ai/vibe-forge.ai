import process from 'node:process'

import type { AdapterCtx, AdapterQueryOptions } from '@vibe-forge/core'
import { loadConfig } from '@vibe-forge/core'
import { getCache, setCache } from '@vibe-forge/core/utils/cache'
import { createLogger } from '@vibe-forge/core/utils/create-logger'
import { uuid } from '@vibe-forge/core/utils/uuid'

import type { RunTaskOptions } from './type'

export const prepare = async (
  options: RunTaskOptions,
  adapterOptions: AdapterQueryOptions
) => {
  const cwd = options.cwd ?? process.env.__VF_PROJECT_WORKSPACE_FOLDER__ ?? process.cwd()

  const {
    sessionId = uuid()
  } = adapterOptions
  const {
    ctxId = process.env.__VF_PROJECT_AI_CTX_ID__ ?? sessionId,
    env: envFromOptions
  } = options
  const {
    __IS_LOADER_CLI__: _0,
    ...prevEnv
  } = {
    ...process.env,
    ...envFromOptions
  }
  const env: Record<string, string | null | undefined> = {
    ...prevEnv,
    __VF_PROJECT_AI_CTX_ID__: ctxId,
    __VF_PROJECT_AI_SESSION_ID__: sessionId,
    __VF_PROJECT_AI_RUN_TYPE__: adapterOptions.runtime,
    // 移除 NODE_OPTIONS 环境变量，防止干扰子进程的运行环境
    NODE_OPTIONS: undefined
  }
  const logger = createLogger(cwd, ctxId, sessionId, env?.LOG_PREFIX ?? '')

  const jsonVariables: Record<string, string | null | undefined> = {
    ...env,
    WORKSPACE_FOLDER: cwd,
    __VF_PROJECT_WORKSPACE_FOLDER__: cwd
  }
  const [config, userConfig] = await loadConfig({ jsonVariables })
  return [
    {
      ctxId,
      cwd,
      env,
      cache: {
        set: (key, value) => setCache(cwd, ctxId, sessionId, key, value),
        get: (key) => getCache(cwd, ctxId, sessionId, key)
      },
      logger,
      configs: [config, userConfig]
    } satisfies AdapterCtx
  ] as const
}
