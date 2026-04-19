import { spawn } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import net from 'node:net'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'

import type { AdapterCtx } from '@vibe-forge/types'
import { resolveProjectAiPath } from '@vibe-forge/utils'
import { ensureManagedNpmCli } from '@vibe-forge/utils/managed-npm-cli'

import { resolveClaudeCodeAdapterConfig } from '../runtime-config'
import { generateDefaultCCRConfigJSON } from './config'
import {
  CLAUDE_CODE_ROUTER_CLI_PACKAGE,
  CLAUDE_CODE_ROUTER_CLI_VERSION,
  resolveAdapterCliPath,
  resolveTransformerRuntimePreloadPath
} from './paths'

const DEFAULT_ROUTER_HOST = '127.0.0.1'
const DEFAULT_ROUTER_PORT = 3456
const DEFAULT_ROUTER_API_TIMEOUT_MS = 600000
const ROUTER_READY_TIMEOUT_MS = 15000
const ROUTER_STOP_TIMEOUT_MS = 5000
const ROUTER_POLL_INTERVAL_MS = 100

export interface ClaudeCodeRouterConnection {
  apiKey: string
  apiTimeoutMs: number
  host: string
  port: number
}

export interface ClaudeCodeRouterDeps {
  isProcessAlive: (pid: number) => boolean
  resolveCliPath: () => string | Promise<string>
  resolveRuntimePreloadPath: () => string | undefined
  spawnDetached: (params: {
    cliPath: string
    cwd: string
    env: NodeJS.ProcessEnv
  }) => Promise<void>
  stopProcess: (pid: number) => Promise<void>
  waitForReady: (port: number, timeoutMs: number) => Promise<void>
}

const normalizePositiveInteger = (value: unknown) => (
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : typeof value === 'string' && /^\d+$/.test(value) && Number(value) > 0
    ? Number(value)
    : undefined
)

const buildRouterPaths = (cwd: string) => {
  const mockHome = resolveProjectAiPath(cwd, process.env, '.mock')
  const routerHome = resolve(mockHome, '.claude-code-router')
  return {
    mockHome,
    routerHome,
    configPath: resolve(routerHome, 'config.json'),
    pidPath: resolve(routerHome, '.claude-code-router.pid')
  }
}

const parseRouterConnection = (configText: string): ClaudeCodeRouterConnection => {
  const config = JSON.parse(configText) as Record<string, unknown>
  return {
    host: DEFAULT_ROUTER_HOST,
    port: normalizePositiveInteger(config.PORT) ?? DEFAULT_ROUTER_PORT,
    apiKey: typeof config.APIKEY === 'string' && config.APIKEY.trim() !== ''
      ? config.APIKEY
      : 'test',
    apiTimeoutMs: normalizePositiveInteger(config.API_TIMEOUT_MS) ?? DEFAULT_ROUTER_API_TIMEOUT_MS
  }
}

const usesTypeScriptTransformers = (configText: string) => {
  try {
    const config = JSON.parse(configText) as {
      transformers?: Array<{ path?: unknown }>
    }
    return config.transformers?.some(
      transformer => typeof transformer.path === 'string' && transformer.path.endsWith('.ts')
    ) ?? false
  } catch {
    return false
  }
}

const mergeNodeOptions = (baseValue: string | undefined, additions: string[]) => {
  const existingParts = (baseValue ?? '').split(/\s+/).filter(Boolean)
  const merged = [
    ...additions,
    ...existingParts
  ]

  return Array.from(new Set(merged)).join(' ').trim()
}

const readPidFile = async (pidPath: string) => {
  try {
    const raw = await readFile(pidPath, 'utf8')
    const pid = Number.parseInt(raw.trim(), 10)
    return Number.isFinite(pid) && pid > 0 ? pid : undefined
  } catch {
    return undefined
  }
}

const isProcessAliveDefault = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const waitForProcessExit = async (
  pid: number,
  timeoutMs: number,
  isProcessAlive: ClaudeCodeRouterDeps['isProcessAlive']
) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) return
    await delay(ROUTER_POLL_INTERVAL_MS)
  }
}

const stopProcessDefault = async (pid: number) => {
  try {
    process.kill(pid)
  } catch {
    return
  }

  await waitForProcessExit(pid, ROUTER_STOP_TIMEOUT_MS, isProcessAliveDefault)
  if (isProcessAliveDefault(pid)) {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      return
    }
    await waitForProcessExit(pid, ROUTER_STOP_TIMEOUT_MS, isProcessAliveDefault)
  }
}

const spawnDetachedDefault: ClaudeCodeRouterDeps['spawnDetached'] = async ({
  cliPath,
  cwd,
  env
}) => {
  await new Promise<void>((resolvePromise, reject) => {
    const proc = spawn(cliPath, ['start'], {
      cwd,
      env,
      detached: true,
      stdio: 'ignore'
    })
    proc.once('error', reject)
    proc.unref()
    setImmediate(resolvePromise)
  })
}

const waitForReadyDefault: ClaudeCodeRouterDeps['waitForReady'] = async (
  port,
  timeoutMs
) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const isReady = await new Promise<boolean>((resolvePromise) => {
      const socket = net.createConnection({
        host: DEFAULT_ROUTER_HOST,
        port
      })

      const finalize = (ready: boolean) => {
        socket.removeAllListeners()
        socket.destroy()
        resolvePromise(ready)
      }

      socket.once('connect', () => finalize(true))
      socket.once('error', () => finalize(false))
    })

    if (isReady) return
    await delay(ROUTER_POLL_INTERVAL_MS)
  }

  throw new Error(`claude-code-router did not become ready on port ${port}`)
}

const defaultRouterDeps: ClaudeCodeRouterDeps = {
  resolveCliPath: resolveAdapterCliPath,
  resolveRuntimePreloadPath: resolveTransformerRuntimePreloadPath,
  isProcessAlive: isProcessAliveDefault,
  spawnDetached: spawnDetachedDefault,
  stopProcess: stopProcessDefault,
  waitForReady: waitForReadyDefault
}

export const ensureClaudeCodeRouterReady = async (
  ctx: Pick<AdapterCtx, 'configState' | 'configs' | 'cwd' | 'env'>,
  deps: Partial<ClaudeCodeRouterDeps> = {}
) => {
  const { cwd, env, configs: [config, userConfig] } = ctx
  const { native: adapterOptions } = resolveClaudeCodeAdapterConfig(ctx)
  const configText = generateDefaultCCRConfigJSON({
    cwd,
    config,
    userConfig,
    adapterOptions
  })
  const routerDeps = {
    ...defaultRouterDeps,
    ...deps
  }
  const hasTypeScriptTransformers = usesTypeScriptTransformers(configText)
  const runtimePreloadPath = hasTypeScriptTransformers
    ? routerDeps.resolveRuntimePreloadPath()
    : undefined
  const connection = parseRouterConnection(configText)
  const { configPath, mockHome, pidPath } = buildRouterPaths(cwd)

  if (hasTypeScriptTransformers && runtimePreloadPath == null) {
    throw new Error('Failed to resolve CCR TypeScript runtime preload')
  }

  await mkdir(dirname(configPath), { recursive: true })

  let previousConfigText: string | undefined
  try {
    previousConfigText = await readFile(configPath, 'utf8')
  } catch {
    previousConfigText = undefined
  }
  const configChanged = previousConfigText !== configText
  if (configChanged) {
    await writeFile(configPath, configText, 'utf8')
  }

  let pid = await readPidFile(pidPath)
  let isRunning = pid != null && routerDeps.isProcessAlive(pid)
  if (!isRunning && pid != null) {
    await rm(pidPath, { force: true })
    pid = undefined
  }

  if (isRunning && configChanged && pid != null) {
    await routerDeps.stopProcess(pid)
    await rm(pidPath, { force: true })
    isRunning = false
  }

  if (!isRunning) {
    const cliPath = deps.resolveCliPath == null
      ? await ensureManagedNpmCli({
        adapterKey: 'claude_code_router',
        binaryName: 'ccr',
        bundledPath: resolveAdapterCliPath(cwd, env, adapterOptions.routerCli),
        config: adapterOptions.routerCli,
        cwd,
        defaultPackageName: CLAUDE_CODE_ROUTER_CLI_PACKAGE,
        defaultVersion: CLAUDE_CODE_ROUTER_CLI_VERSION,
        env,
        logger: {
          info: () => undefined
        },
        versionArgs: ['version']
      })
      : await routerDeps.resolveCliPath()
    env.__VF_PROJECT_AI_ADAPTER_CLAUDE_CODE_ROUTER_CLI_PATH__ = cliPath
    const spawnEnv: NodeJS.ProcessEnv = {
      ...process.env,
      ...env,
      HOME: mockHome
    }

    if (runtimePreloadPath != null) {
      spawnEnv.NODE_OPTIONS = mergeNodeOptions(spawnEnv.NODE_OPTIONS, [
        '--conditions=__vibe-forge__',
        `--require=${runtimePreloadPath}`
      ])
    }

    await routerDeps.spawnDetached({
      cliPath,
      cwd,
      env: spawnEnv
    })
  }

  await routerDeps.waitForReady(connection.port, ROUTER_READY_TIMEOUT_MS)
  return connection
}
