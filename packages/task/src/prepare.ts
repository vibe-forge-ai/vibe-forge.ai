import process from 'node:process'

import { buildConfigJsonVariables, loadConfig, resolveUseDefaultVibeForgeMcpServer } from '@vibe-forge/config'
import type { AdapterCtx, AdapterQueryOptions } from '@vibe-forge/types'
import { getCache, setCache } from '@vibe-forge/utils/cache'
import { createLogger } from '@vibe-forge/utils/create-logger'
import { resolveServerLogLevel } from '@vibe-forge/utils/log-level'
import { uuid } from '@vibe-forge/utils/uuid'
import { resolveWorkspaceAssetBundle } from '@vibe-forge/workspace-assets'

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
    __VF_PROJECT_AI_PERMISSION_MODE__: adapterOptions.permissionMode ?? prevEnv.__VF_PROJECT_AI_PERMISSION_MODE__,
    __VF_PROJECT_AI_ENABLE_BUILTIN_PERMISSION_HOOKS__: (
        adapterOptions.runtime === 'server' || adapterOptions.runtime === 'mcp'
      )
      ? '1'
      : undefined,
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
  const [config, userConfig] = await loadConfig({ cwd, jsonVariables })
  const assets = adapterOptions.assetBundle ?? await resolveWorkspaceAssetBundle({
    cwd,
    configs: [config, userConfig],
    plugins: options.plugins,
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
