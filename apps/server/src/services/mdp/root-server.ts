import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'

import {
  MdpFilesystemStateStore,
  MdpServerRuntime,
  MdpTransportServer
} from '@modeldriveprotocol/server'
import {
  resolveMdpConfig,
  type MdpBridgeRequest,
  type MdpBridgeResponse
} from '@vibe-forge/mdp'
import type { Config } from '@vibe-forge/types'

import { logger } from '#~/utils/logger.js'

const LOCAL_MDP_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1'])
const LOCAL_MDP_META_PROBE_TIMEOUT_MS = 1_000
const LOCAL_MDP_STOP_TIMEOUT_MS = 5_000
const LOCAL_MDP_INVOCATION_TIMEOUT_MS = 120_000

interface StateStoreSnapshot {
  server?: {
    pid?: number
    serverId?: string
    clusterMode?: string
  }
}

interface ManagedMdpRootServer {
  targetUrl: string
  runtime: MdpServerRuntime
  transportServer: MdpTransportServer
  stateStore: MdpFilesystemStateStore
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

const queueStateStoreUpdate = (operation: Promise<unknown> | undefined) => {
  if (operation == null) {
    return
  }

  void operation.catch((error) => {
    logger.error({ error }, '[mdp] local root state store update failed')
  })
}

const invokeRuntime = async (
  runtime: MdpServerRuntime,
  request: Extract<MdpBridgeRequest, { method: 'callPath' }>['params']
) => (
  await runtime.invoke({
    clientId: request.clientId,
    method: request.method,
    path: request.path,
    ...(request.query ? { query: request.query } : {}),
    ...(request.body !== undefined ? { body: request.body } : {}),
    ...(request.headers ? { headers: request.headers } : {}),
    ...(request.auth ? { auth: request.auth } : {})
  })
)

const executeRuntimeBridgeRequest = async (
  runtime: MdpServerRuntime,
  request: MdpBridgeRequest
): Promise<MdpBridgeResponse> => {
  switch (request.method) {
    case 'listClients':
      return {
        clients: runtime.listClients(request.params)
      }
    case 'listPaths':
      return {
        paths: runtime.capabilityIndex.listPaths(request.params)
      }
    case 'callPath':
      return await invokeRuntime(runtime, request.params)
    case 'callPaths': {
      const targetClientIds = request.params.clientIds != null && request.params.clientIds.length > 0
        ? request.params.clientIds
        : runtime.findMatchingClientIds({
            method: request.params.method,
            path: request.params.path
          })

      if (targetClientIds.length === 0) {
        throw new Error('No matching MDP clients were found')
      }

      const results = await Promise.all(targetClientIds.map(async (clientId: string) => {
        const result = await invokeRuntime(runtime, {
          clientId,
          method: request.params.method,
          path: request.params.path,
          ...(request.params.query ? { query: request.params.query } : {}),
          ...(request.params.body !== undefined ? { body: request.params.body } : {}),
          ...(request.params.headers ? { headers: request.params.headers } : {}),
          ...(request.params.auth ? { auth: request.params.auth } : {})
        })

        if (result.ok) {
          return {
            clientId,
            ok: true,
            data: result.data
          }
        }

        return {
          clientId,
          ok: false,
          error: result.error ?? { message: 'Unknown client error' }
        }
      }))

      return {
        results
      }
    }
  }
}

const stopManagedServer = async (server: ManagedMdpRootServer) => {
  await Promise.allSettled([
    server.transportServer.stop(),
    server.runtime.close()
  ])
  await server.stateStore.markStopped()
}

export const executeLocalMdpBridgeRequest = async (
  targetUrl: string,
  request: MdpBridgeRequest
): Promise<MdpBridgeResponse> => {
  const server = activeServers.find(item => item.targetUrl === targetUrl)
  if (server == null) {
    throw new Error(`No managed local MDP root server is available for "${targetUrl}"`)
  }

  return await executeRuntimeBridgeRequest(server.runtime, request)
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

    let runtime: MdpServerRuntime | undefined
    let stateStore: MdpFilesystemStateStore | undefined
    let transportServer: MdpTransportServer | undefined

    try {
      const target = new URL(targetUrl)
      const runtimeInstance = new MdpServerRuntime({
        invocationTimeoutMs: LOCAL_MDP_INVOCATION_TIMEOUT_MS,
        onClientRegistered: () => {
          queueStateStoreUpdate(stateStore?.syncRegistry())
        },
        onClientRemoved: () => {
          queueStateStoreUpdate(stateStore?.syncRegistry())
        },
        onClientStateChanged: () => {
          queueStateStoreUpdate(stateStore?.syncRegistry())
        }
      })
      runtime = runtimeInstance
      stateStore = new MdpFilesystemStateStore({
        directory: stateStoreDir,
        serverId,
        clusterId: serverId,
        clusterMode: 'standalone',
        startupCwd: params.workspaceFolder,
        getClients: () => runtimeInstance.listClients(),
        getRoutes: () => runtimeInstance.capabilityIndex.listPaths({
          depth: Number.MAX_SAFE_INTEGER
        })
      })
      await stateStore.start()

      transportServer = new MdpTransportServer(runtimeInstance, {
        host: target.hostname,
        port: Number(target.port || '47372'),
        serverId
      })
      await transportServer.start()
      queueStateStoreUpdate(stateStore.setTransportListening(transportServer.endpoints))
      queueStateStoreUpdate(stateStore.setMcpBridgeConnected())

      activeServers.push({
        targetUrl,
        runtime,
        transportServer,
        stateStore
      })
      logger.info({ targetUrl }, '[mdp] local root server ready')
    } catch (error) {
      await Promise.allSettled([
        transportServer?.stop() ?? Promise.resolve(),
        runtime?.close() ?? Promise.resolve()
      ])
      await stateStore?.markStopped()
      throw error
    }
  }
}
