import { spawn } from 'node:child_process'
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import net from 'node:net'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'

import type { AdapterCtx, Config } from '@vibe-forge/types'
import { omitAdapterCommonConfig } from '@vibe-forge/utils'

import { generateDefaultCCRConfigJSON } from './config'
import { resolveAdapterCliPath } from './paths'

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
  resolveCliPath: () => string
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
  const mockHome = resolve(cwd, '.ai/.mock')
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
  isProcessAlive: isProcessAliveDefault,
  spawnDetached: spawnDetachedDefault,
  stopProcess: stopProcessDefault,
  waitForReady: waitForReadyDefault
}

const resolveAdapterOptions = (params: {
  config?: Config
  userConfig?: Config
}) => {
  const { config, userConfig } = params
  return omitAdapterCommonConfig({
    ...(config?.adapters?.['claude-code'] ?? {}),
    ...(userConfig?.adapters?.['claude-code'] ?? {})
  })
}

export const ensureClaudeCodeRouterReady = async (
  ctx: Pick<AdapterCtx, 'configs' | 'cwd' | 'env'>,
  deps: Partial<ClaudeCodeRouterDeps> = {}
) => {
  const { cwd, env, configs: [config, userConfig] } = ctx
  const adapterOptions = resolveAdapterOptions({ config, userConfig })
  const configText = generateDefaultCCRConfigJSON({
    cwd,
    config,
    userConfig,
    adapterOptions
  })
  const connection = parseRouterConnection(configText)
  const { configPath, mockHome, pidPath } = buildRouterPaths(cwd)
  const routerDeps = {
    ...defaultRouterDeps,
    ...deps
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
    const cliPath = routerDeps.resolveCliPath()
    await access(cliPath)
    await routerDeps.spawnDetached({
      cliPath,
      cwd,
      env: {
        ...process.env,
        ...env,
        HOME: mockHome
      }
    })
  }

  await routerDeps.waitForReady(connection.port, ROUTER_READY_TIMEOUT_MS)
  return connection
}
