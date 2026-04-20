import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'

import {
  resolveMdpConfig,
  startManagedLocalRootBridgeClient,
  type ManagedLocalRootBridgeClient,
  type MdpBridgeRequest,
  type MdpBridgeResponse
} from '@vibe-forge/mdp'
import type { Config } from '@vibe-forge/types'

import { logger } from '#~/utils/logger.js'

const LOCAL_MDP_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1'])
const LOCAL_MDP_META_TIMEOUT_MS = 10_000
const LOCAL_MDP_META_POLL_INTERVAL_MS = 200
const LOCAL_MDP_META_PROBE_TIMEOUT_MS = 1_000
const LOCAL_MDP_STOP_TIMEOUT_MS = 5_000

interface StateStoreSnapshot {
  server?: {
    pid?: number
    serverId?: string
    clusterMode?: string
  }
}

interface ManagedMdpRootServer {
  targetUrl: string
  managed: boolean
  bridge?: ManagedLocalRootBridgeClient
}

let activeServers: ManagedMdpRootServer[] = []

const isLocalMdpUrl = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl)
    return (
      (url.protocol === 'ws:' || url.protocol === 'wss:') &&
      LOCAL_MDP_HOSTNAMES.has(url.hostname) &&
      (url.pathname === '' || url.pathname === '/')
    )
  } catch {
    return false
  }
}

const toMdpMetaUrl = (rawUrl: string) => {
  const url = new URL(rawUrl)
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:'
  url.pathname = '/mdp/meta'
  url.search = ''
  url.hash = ''
  return url.toString()
}

const probeMetaEndpoint = async (rawUrl: string) => {
  try {
    const response = await fetch(toMdpMetaUrl(rawUrl), {
      signal: AbortSignal.timeout(LOCAL_MDP_META_PROBE_TIMEOUT_MS)
    })
    if (!response.ok) {
      return undefined
    }
    return await response.json() as {
      serverId?: string
    }
  } catch {
    return undefined
  }
}

const formatStartupError = (stderr: string) => {
  const trimmed = stderr.trim()
  return trimmed === '' ? 'MDP root server did not become ready in time' : trimmed
}

const waitForRootServerReady = async (params: {
  targetUrl: string
  stderrBuffer: string[]
}) => {
  const startedAt = Date.now()

  while (Date.now() - startedAt < LOCAL_MDP_META_TIMEOUT_MS) {
    const meta = await probeMetaEndpoint(params.targetUrl)
    if (meta != null) {
      return
    }

    await delay(LOCAL_MDP_META_POLL_INTERVAL_MS)
  }

  throw new Error(formatStartupError(params.stderrBuffer.join('\n')))
}

const createServerId = (targetUrl: string) => {
  const url = new URL(targetUrl)
  return `vibe-forge-${url.hostname.replace(/[^a-z0-9.-]/gi, '-')}-${url.port || '47372'}`
}

const isProcessAlive = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const stopStaleOwnedServer = async (params: {
  stateStoreDir: string
  expectedServerId: string
  targetUrl: string
}) => {
  const meta = await probeMetaEndpoint(params.targetUrl)
  if (meta?.serverId !== params.expectedServerId) {
    return
  }

  const snapshotPath = resolve(params.stateStoreDir, 'snapshot.json')
  let snapshot: StateStoreSnapshot | undefined
  try {
    snapshot = JSON.parse(await readFile(snapshotPath, 'utf8')) as StateStoreSnapshot
  } catch {
    return
  }

  const pid = snapshot.server?.pid
  if (
    snapshot.server?.serverId !== params.expectedServerId ||
    typeof pid !== 'number' ||
    !isProcessAlive(pid)
  ) {
    return
  }

  process.kill(pid, 'SIGTERM')

  const startedAt = Date.now()
  while (Date.now() - startedAt < LOCAL_MDP_STOP_TIMEOUT_MS) {
    if (!isProcessAlive(pid) || await probeMetaEndpoint(params.targetUrl) == null) {
      return
    }
    await delay(100)
  }

  if (isProcessAlive(pid)) {
    process.kill(pid, 'SIGKILL')
  }
}

const stopManagedServer = async (server: ManagedMdpRootServer) => {
  if (!server.managed || server.bridge == null) {
    return
  }

  await server.bridge.close()
}

export const executeLocalMdpBridgeRequest = async (
  targetUrl: string,
  request: MdpBridgeRequest
): Promise<MdpBridgeResponse> => {
  const server = activeServers.find(item => item.targetUrl === targetUrl)
  if (server?.bridge == null) {
    throw new Error(`No managed local MDP root server is available for "${targetUrl}"`)
  }

  return await server.bridge.request(request)
}

export const stopLocalMdpRootServer = async () => {
  if (activeServers.length === 0) {
    return
  }

  const servers = activeServers
  activeServers = []
  await Promise.allSettled(servers.map(stopManagedServer))
}

export const startLocalMdpRootServer = async (params: {
  workspaceFolder: string
  mergedConfig: Config | undefined
}) => {
  await stopLocalMdpRootServer()

  const mdp = resolveMdpConfig(params.mergedConfig)
  if (!mdp.enabled) {
    return
  }

  const targetUrls = Array.from(
    new Set(
      mdp.connections
        .flatMap(connection => connection.hosts)
        .filter(isLocalMdpUrl)
    )
  )

  if (targetUrls.length === 0) {
    return
  }

  const stateStoreDir = resolve(params.workspaceFolder, '.logs', 'mdp-state')

  for (const targetUrl of targetUrls) {
    const serverId = createServerId(targetUrl)
    await stopStaleOwnedServer({
      stateStoreDir,
      expectedServerId: serverId,
      targetUrl
    })

    try {
      const bridge = await startManagedLocalRootBridgeClient({
        cwd: params.workspaceFolder,
        targetUrl,
        stateStoreDir,
        serverId
      })
      await waitForRootServerReady({
        targetUrl,
        stderrBuffer: []
      })
      activeServers.push({
        targetUrl,
        managed: true,
        bridge
      })
      logger.info({ targetUrl }, '[mdp] local root server ready')
    } catch (error) {
      throw error
    }
  }
}
