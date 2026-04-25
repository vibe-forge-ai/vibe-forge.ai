import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import process from 'node:process'

import { resolveProjectAiBaseDir, resolveProjectWorkspaceFolder } from '@vibe-forge/register/dotenv'
import { linkRealHomeGitConfig } from '@vibe-forge/register/mock-home-git'

const nodeRequire = createRequire(__filename)

export interface RuntimeCliOptions {
  allowCors?: boolean
  base?: string
  configDir?: string
  dataDir?: string
  host?: string
  logDir?: string
  port?: string
  publicBaseUrl?: string
  workspace?: string
  wsPath?: string
}

export interface RuntimeEnvDefaults {
  allowCors?: boolean
  clientBase?: string
  clientMode?: 'dev' | 'none' | 'static'
  entryKind?: 'server' | 'web'
  serverHost?: string
  serverPort?: string
  serverWsPath?: string
}

export interface ApplyServerRuntimeEnvOptions {
  baseEnv?: NodeJS.ProcessEnv
  cwd?: string
  defaults: RuntimeEnvDefaults
  options: RuntimeCliOptions
  packageDir: string
}

export interface RunRuntimeEntryOptions {
  entryPath: string
  env: NodeJS.ProcessEnv
}

const resolveOptionPath = (cwd: string, value?: string) => {
  const trimmedValue = value?.trim()
  if (!trimmedValue) {
    return undefined
  }

  return resolve(cwd, trimmedValue)
}

export const applyServerRuntimeEnv = (params: ApplyServerRuntimeEnvOptions) => {
  const launchCwd = resolve(params.cwd ?? process.cwd())
  const nextEnv: NodeJS.ProcessEnv = {
    ...(params.baseEnv ?? process.env),
    __VF_PROJECT_LAUNCH_CWD__: launchCwd
  }

  if (params.defaults.serverHost != null) {
    nextEnv.__VF_PROJECT_AI_SERVER_HOST__ = params.options.host ??
      nextEnv.__VF_PROJECT_AI_SERVER_HOST__ ??
      params.defaults.serverHost
  }

  if (params.defaults.serverPort != null) {
    nextEnv.__VF_PROJECT_AI_SERVER_PORT__ = params.options.port ??
      nextEnv.__VF_PROJECT_AI_SERVER_PORT__ ??
      params.defaults.serverPort
  }

  if (params.defaults.serverWsPath != null) {
    nextEnv.__VF_PROJECT_AI_SERVER_WS_PATH__ = params.options.wsPath ??
      nextEnv.__VF_PROJECT_AI_SERVER_WS_PATH__ ??
      params.defaults.serverWsPath
  }

  if (params.defaults.allowCors != null) {
    nextEnv.__VF_PROJECT_AI_SERVER_ALLOW_CORS__ = params.options.allowCors === true
      ? 'true'
      : nextEnv.__VF_PROJECT_AI_SERVER_ALLOW_CORS__ ?? (params.defaults.allowCors ? 'true' : 'false')
  }

  if (params.defaults.clientMode != null) {
    nextEnv.__VF_PROJECT_AI_CLIENT_MODE__ = params.defaults.clientMode
  }

  if (params.defaults.clientBase != null) {
    nextEnv.__VF_PROJECT_AI_CLIENT_BASE__ = params.options.base ??
      nextEnv.__VF_PROJECT_AI_CLIENT_BASE__ ??
      params.defaults.clientBase
  }

  if (params.defaults.entryKind != null) {
    nextEnv.__VF_PROJECT_AI_SERVER_ENTRY_KIND__ = params.defaults.entryKind
  }

  if (typeof params.options.publicBaseUrl === 'string') {
    nextEnv.__VF_PROJECT_AI_PUBLIC_BASE_URL__ = params.options.publicBaseUrl
  }

  if (typeof params.options.dataDir === 'string') {
    nextEnv.__VF_PROJECT_AI_SERVER_DATA_DIR__ = params.options.dataDir
  }

  if (typeof params.options.logDir === 'string') {
    nextEnv.__VF_PROJECT_AI_SERVER_LOG_DIR__ = params.options.logDir
  }

  const workspaceFolder = resolveOptionPath(launchCwd, params.options.workspace) ??
    resolveProjectWorkspaceFolder(launchCwd, nextEnv)
  nextEnv.__VF_PROJECT_WORKSPACE_FOLDER__ = workspaceFolder

  const configDir = resolveOptionPath(launchCwd, params.options.configDir)
  if (configDir != null) {
    nextEnv.__VF_PROJECT_CONFIG_DIR__ = configDir
  }

  nextEnv.__VF_PROJECT_PACKAGE_DIR__ = params.packageDir
  nextEnv.__VF_PROJECT_REAL_HOME__ = nextEnv.__VF_PROJECT_REAL_HOME__ ?? nextEnv.HOME ?? ''
  nextEnv.HOME = resolve(resolveProjectAiBaseDir(workspaceFolder, nextEnv), '.mock')
  linkRealHomeGitConfig({
    realHome: nextEnv.__VF_PROJECT_REAL_HOME__,
    mockHome: nextEnv.HOME
  })

  return nextEnv
}

export const runRuntimeEntry = async (options: RunRuntimeEntryOptions) => {
  const child = spawn(
    process.execPath,
    [
      '--conditions=__vibe-forge__',
      '-r',
      nodeRequire.resolve('@vibe-forge/register/preload'),
      options.entryPath
    ],
    {
      cwd: process.cwd(),
      env: options.env,
      stdio: 'inherit'
    }
  )

  const forwardSignal = (signal: NodeJS.Signals) => {
    if (!child.killed) {
      child.kill(signal)
    }
  }

  const handleSigint = () => {
    forwardSignal('SIGINT')
  }

  const handleSigterm = () => {
    forwardSignal('SIGTERM')
  }

  const cleanup = () => {
    process.off('SIGINT', handleSigint)
    process.off('SIGTERM', handleSigterm)
  }

  process.on('SIGINT', handleSigint)
  process.on('SIGTERM', handleSigterm)

  return await new Promise<number>((resolvePromise, reject) => {
    child.once('error', (error) => {
      cleanup()
      reject(error)
    })

    child.once('exit', (code, signal) => {
      cleanup()
      if (signal != null) {
        process.kill(process.pid, signal)
        return
      }

      resolvePromise(code ?? 0)
    })
  })
}
