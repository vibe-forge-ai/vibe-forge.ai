import process from 'node:process'

import {
  buildConfigJsonVariables,
  loadConfig,
  resolveUseDefaultVibeForgeMcpServer
} from '@vibe-forge/config'
import type { AdapterCtx, AdapterQueryOptions, Config  } from '@vibe-forge/types'
import { resolveWorkspaceAssetBundle } from '@vibe-forge/workspace-assets'
import { getCache, setCache } from '@vibe-forge/utils/cache'
import { createLogger } from '@vibe-forge/utils/create-logger'
import { resolveServerLogLevel } from '@vibe-forge/utils/log-level'
import { uuid } from '@vibe-forge/utils/uuid'

import type { RunTaskOptions } from '#~/type.js'

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
  const logger = createLogger(
    cwd,
    ctxId,
    sessionId,
    env?.LOG_PREFIX ?? '',
    resolveServerLogLevel(env)
  )

  const jsonVariables = buildConfigJsonVariables(cwd, env)
  const [config, userConfig] = await loadConfig<Config>({ cwd, jsonVariables })
  const assets = await resolveWorkspaceAssetBundle({
    cwd,
    configs: [config, userConfig],
    useDefaultVibeForgeMcpServer: resolveUseDefaultVibeForgeMcpServer({
      runtimeValue: adapterOptions.useDefaultVibeForgeMcpServer,
      projectConfig: config,
      userConfig
    })
  })
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
      configs: [config, userConfig],
      assets
    } satisfies AdapterCtx
  ] as const
}
