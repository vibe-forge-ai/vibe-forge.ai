import fs from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'

import type { AdapterCtx, AdapterQueryOptions } from '@vibe-forge/core'
import { Settings, loadConfig } from '@vibe-forge/core'
import { getCache, setCache } from '@vibe-forge/core/utils/cache'
import { createLogger } from '@vibe-forge/core/utils/create-logger'
import { uuid } from '@vibe-forge/core/utils/uuid'

import type { RunTaskOptions } from './type'

export const prepare = async (
  options: RunTaskOptions,
  adapterOptions: AdapterQueryOptions
) => {
  const cwd = options.cwd ?? process.env.WORKSPACE_FOLDER! ?? process.cwd()

  const { taskId = uuid(), env: envFromOptions } = options
  const { sessionId = uuid() } = adapterOptions

  const {
    __IS_LOADER_CLI__: _0,
    // 移除 NODE_OPTIONS 环境变量，防止干扰子进程的运行环境
    NODE_OPTIONS: _1,
    ...ignoredEnv
  } = process.env
  const env: Record<string, string | undefined> = {
    ...ignoredEnv,
    ...envFromOptions,

    // 标识当前任务调用属于同一个上下文
    TAG_UUID: taskId,

    // 移除不关注的环境变量，这些是 trae 相关的环境变量
    VSCODE_CRASH_REPORTER_PROCESS_TYPE: undefined,
    VSCODE_RUN_IN_ELECTRON: undefined,
    VSCODE_EXTENSIONS_PATH: undefined,
    VSCODE_HANDLES_UNCAUGHT_ERRORS: undefined,
    VSCODE_ESM_ENTRYPOINT: undefined,
    VSCODE_BUILTIN_EXTENSIONS_PATH: undefined,
    VSCODE_NLS_CONFIG: undefined,
    VSCODE_IPC_HOOK: undefined,
    VSCODE_CODE_CACHE_PATH: undefined,
    VSCODE_PID: undefined,
    VSCODE_CWD: undefined,

    ICUBE_VSCODE_VERSION: undefined,
    ICUBE_ENABLE_MARSCODE_NLS: undefined,
    ICUBE_CODEMAIN_SESSION: undefined,
    ICUBE_IS_ELECTRON: undefined,
    ICUBE_QUALITY: undefined,
    ICUBE_USE_IPV6: undefined,
    ICUBE_PROXY_HOST: undefined,
    ICUBE_BUILD_TIME: undefined,
    ICUBE_ELECTRON_PATH: undefined,
    ICUBE_MARSCODE_VERSION: undefined,
    ICUBE_PRODUCT_PROVIDER: undefined,
    ICUBE_BUILD_VERSION: undefined,
    ICUBE_PROVIDER: undefined,
    ICUBE_APP_VERSION: undefined,
    ICUBE_MACHINE_ID: undefined,

    CLOUDIDE_APISERVER_BASE_URL: undefined,
    CLOUDIDE_PROVIDER_REGION: undefined,

    __CFBundleIdentifier: undefined,
    XPC_SERVICE_NAME: undefined
  }

  const logger = createLogger(cwd, taskId, sessionId, env?.LOG_PREFIX)

  const jsonVariables: Record<string, string | undefined> = {
    ...env
  }
  const [config, userConfig] = await loadConfig({ jsonVariables })
  const settingsJSONContent = (
    await fs.readFile(resolve(cwd, '.ai/settings.json'), 'utf-8')
  )
    .toString()
    .replace(
      /\$\{([^}]+)\}/g,
      (_, key: string) => jsonVariables[key] ?? `$\{${key}}`
    )
  const settings = Settings.parse(JSON.parse(settingsJSONContent))
  const { mcpServers = {} } = settings
  for (const [, mcpServer] of Object.entries(mcpServers)) {
    mcpServer.env = {
      ...mcpServer.env,
      __VF_PROJECT_AI_TASK_ID__: taskId,
      __VF_PROJECT_AI_SESSION_ID__: sessionId,
      __VF_PROJECT_AI_SERVER_HOST__: env.SERVER_HOST ?? 'localhost',
      __VF_PROJECT_AI_SERVER_PORT__: env.SERVER_PORT ?? '8787',
      __VF_PROJECT_AI_RUN_TYPE__: adapterOptions.runtime
    }
  }
  return [
    {
      taskId,
      cwd,
      env,
      cache: {
        set: (key, value) => setCache(cwd, taskId, sessionId, key, value),
        get: (key) => getCache(cwd, taskId, sessionId, key)
      },
      logger,
      configs: [config, userConfig],
      settings
    } satisfies AdapterCtx
  ] as const
}
