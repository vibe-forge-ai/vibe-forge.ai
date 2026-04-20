import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'

import type { McpBridgeRequestHandler } from '@modeldriveprotocol/server'
import type { Config, MdpClientSummary, MdpFilterConfig, MdpPathSummary, MdpSummaryResponse } from '@vibe-forge/types'
import {
  resolvePrimaryWorkspaceFolder,
  resolveProjectLaunchCwd,
  resolveProjectWorkspaceFolder
} from '@vibe-forge/utils'

import { parseSyntheticClientId, toSyntheticClientId } from './client-id'
import type { ResolvedMdpConfig, ResolvedMdpConnection } from './config'
import { resolveMdpConfig } from './config'
import { isVisibleMdpClient, isVisibleMdpPath } from './filter'
import { withQueryWorker } from './query-worker'

type BridgeRequest = Parameters<McpBridgeRequestHandler>[0]
export type MdpBridgeRequest = BridgeRequest
export type MdpBridgeResponse = Awaited<ReturnType<McpBridgeRequestHandler>>
type HttpMethod = Extract<BridgeRequest, { method: 'callPath' }>['params']['method']

interface RawClientRecord {
  id: string
  name: string
  description?: string
  connectedAt?: string
  lastSeenAt?: string
  metadata?: Record<string, unknown>
}

interface RawPathRecord {
  clientId: string
  path: string
  type?: string
  description?: string
  methods?: string[]
}

interface StateStoreClientRecord {
  id?: string
  name?: string
  description?: string
  status?: string
  connectedAt?: string
  lastSeenAt?: string
  metadata?: Record<string, unknown>
  paths?: Array<{
    path?: string
    type?: string
    description?: string
    method?: string
    methods?: string[]
  }>
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null &&
  typeof value === 'object' &&
  !Array.isArray(value)
)

const toRawClientRecord = (value: unknown): RawClientRecord | undefined => {
  if (!isRecord(value)) return undefined
  const id = typeof value.id === 'string' ? value.id : undefined
  const name = typeof value.name === 'string' ? value.name : undefined
  if (id == null || name == null) return undefined
  return {
    id,
    name,
    ...(typeof value.description === 'string' ? { description: value.description } : {}),
    ...(typeof value.connectedAt === 'string' ? { connectedAt: value.connectedAt } : {}),
    ...(typeof value.lastSeenAt === 'string' ? { lastSeenAt: value.lastSeenAt } : {}),
    ...(isRecord(value.metadata) ? { metadata: value.metadata } : {})
  }
}

const toRawPathRecord = (value: unknown): RawPathRecord | undefined => {
  if (!isRecord(value)) return undefined
  const clientId = typeof value.clientId === 'string' ? value.clientId : undefined
  const path = typeof value.path === 'string' ? value.path : undefined
  if (clientId == null || path == null) return undefined
  return {
    clientId,
    path,
    ...(typeof value.type === 'string' ? { type: value.type } : {}),
    ...(typeof value.description === 'string' ? { description: value.description } : {}),
    ...(Array.isArray(value.methods)
      ? {
          methods: value.methods.filter((method): method is string => typeof method === 'string')
        }
      : {})
  }
}

const LOCAL_MDP_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1'])
const LOCAL_MDP_BRIDGE_TIMEOUT_MS = 10_000

const isLocalMdpHost = (host: string) => {
  try {
    return LOCAL_MDP_HOSTNAMES.has(new URL(host).hostname)
  } catch {
    return false
  }
}

const normalizeLocalBridgeHost = (host: string) => {
  const normalized = host.trim()
  if (normalized === '' || normalized === '0.0.0.0' || normalized === '::') {
    return 'localhost'
  }

  if (normalized.includes(':') && !normalized.startsWith('[') && !normalized.endsWith(']')) {
    return `[${normalized}]`
  }

  return normalized
}

const resolveLocalBridgeApiBaseUrls = () => {
  const configuredHost = process.env.__VF_PROJECT_AI_SERVER_HOST__?.trim() || 'localhost'
  const port = process.env.__VF_PROJECT_AI_SERVER_PORT__?.trim() || '8787'
  const candidates = [
    configuredHost,
    'localhost',
    '127.0.0.1',
    '::1'
  ]

  return [...new Set(candidates.map(normalizeLocalBridgeHost))]
    .map(host => `http://${host}:${port}`)
}

const canUseLocalBridgeApi = (connection: ResolvedMdpConnection) => (
  connection.hosts.length === 1 &&
  isLocalMdpHost(connection.hosts[0])
)

const callLocalBridgeApi = async <T>(params: {
  targetUrl: string
  request: BridgeRequest
}) => {
  let lastError: unknown

  for (const baseUrl of resolveLocalBridgeApiBaseUrls()) {
    try {
      const response = await fetch(`${baseUrl}/api/mdp/bridge`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          targetUrl: params.targetUrl,
          request: params.request
        }),
        signal: AbortSignal.timeout(LOCAL_MDP_BRIDGE_TIMEOUT_MS)
      })

      const rawBody = await response.text()
      const payload = rawBody.trim() === ''
        ? undefined
        : JSON.parse(rawBody) as
            | {
                success?: boolean
                data?: T
                error?: string | { message?: string }
                details?: {
                  message?: string
                }
              }
            | T
            | {
                error?: string
                details?: {
                  message?: string
                }
              }

      if (!response.ok) {
        const detailMessage = isRecord(payload)
          ? (
              isRecord(payload.details) && typeof payload.details.message === 'string'
                ? payload.details.message
                : isRecord(payload.error) && typeof payload.error.message === 'string'
                  ? payload.error.message
                  : typeof payload.error === 'string'
                    ? payload.error
                    : undefined
            )
          : undefined
        throw new Error(detailMessage ?? `Local MDP bridge request failed with status ${response.status}`)
      }

      if (payload == null) {
        throw new Error('Local MDP bridge returned an empty response')
      }

      if (isRecord(payload)) {
        const envelope = payload as Record<string, unknown>
        if (envelope.success === true && 'data' in envelope) {
          return envelope.data as T
        }
      }

      return payload as T
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

const readJsonFile = async <T>(filePath: string): Promise<T | undefined> => {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T
  } catch {
    return undefined
  }
}

const resolveLocalStateStoreRoots = (cwd: string) => {
  const roots = [
    resolve(cwd),
    resolveProjectLaunchCwd(cwd),
    resolveProjectWorkspaceFolder(cwd),
    resolvePrimaryWorkspaceFolder(cwd)
  ].filter((root): root is string => root != null)

  return [...new Set(roots)]
}

const findLocalStateStoreClients = async (cwd: string) => {
  for (const root of resolveLocalStateStoreRoots(cwd)) {
    for (const storeDir of [
      resolve(root, '.logs/mdp-state'),
      resolve(root, '.mdp/store')
    ]) {
    const clients = await readJsonFile<StateStoreClientRecord[]>(resolve(storeDir, 'clients.json'))
    if (Array.isArray(clients) && clients.length > 0) {
      return clients
    }
  }
  }
  return undefined
}

const toRawPathRecordsFromStateStoreClient = (client: StateStoreClientRecord): RawPathRecord[] => {
  const clientId = typeof client.id === 'string' ? client.id : undefined
  if (clientId == null) return []

  return (client.paths ?? [])
    .map((path) => {
      const normalizedPath = typeof path.path === 'string' ? path.path : undefined
      if (normalizedPath == null) return undefined
      return {
        clientId,
        path: normalizedPath,
        ...(typeof path.type === 'string' ? { type: path.type } : {}),
        ...(typeof path.description === 'string' ? { description: path.description } : {}),
        ...(Array.isArray(path.methods)
          ? { methods: path.methods.filter((method): method is string => typeof method === 'string') }
          : typeof path.method === 'string'
            ? { methods: [path.method] }
            : {})
      } satisfies RawPathRecord
    })
    .filter((path): path is RawPathRecord => path != null)
}

const createLocalStateStoreSummary = async (params: {
  cwd: string
  connection: ResolvedMdpConnection
  filters: Required<MdpFilterConfig>
}) => {
  if (params.connection.hosts.length !== 1 || !isLocalMdpHost(params.connection.hosts[0])) {
    return undefined
  }

  const clients = await findLocalStateStoreClients(params.cwd)
  if (clients == null) {
    return undefined
  }

  const onlineClients = clients.filter((client) => (
    client.status == null || client.status === 'online'
  ))

  const rawClients = onlineClients
    .map(toRawClientRecord)
    .filter((client): client is RawClientRecord => client != null)
  const rawPaths = onlineClients.flatMap(toRawPathRecordsFromStateStoreClient)

  if (rawClients.length === 0 && rawPaths.length === 0) {
    return undefined
  }

  return normalizeSummary({
    connection: params.connection,
    selectedHost: params.connection.hosts[0],
    clients: rawClients,
    paths: rawPaths,
    filters: params.filters
  })
}

const enrichSummaryFromLocalStateStore = async (params: {
  cwd: string
  connection: ResolvedMdpConnection
  summary: ReturnType<typeof normalizeSummary>
}) => {
  if (params.connection.hosts.length !== 1 || !isLocalMdpHost(params.connection.hosts[0])) {
    return params.summary
  }

  const clients = await findLocalStateStoreClients(params.cwd)
  if (clients == null) {
    return params.summary
  }

  const onlineClients = clients.filter((client) => (
    client.status == null || client.status === 'online'
  ))
  const stateStoreLookup = new Map(
    onlineClients
      .filter((client): client is StateStoreClientRecord & { id: string } => typeof client.id === 'string')
      .map(client => [client.id, client] as const)
  )

  return {
    ...params.summary,
    clients: params.summary.clients.map((client) => {
      const stateStoreClient = stateStoreLookup.get(client.rawClientId)
      if (stateStoreClient == null) {
        return client
      }

      return {
        ...client,
        ...(client.connectedAt == null && typeof stateStoreClient.connectedAt === 'string'
          ? { connectedAt: stateStoreClient.connectedAt }
          : {}),
        ...(client.lastSeenAt == null && typeof stateStoreClient.lastSeenAt === 'string'
          ? { lastSeenAt: stateStoreClient.lastSeenAt }
          : {})
      }
    })
  }
}

const normalizeSummary = (params: {
  connection: ResolvedMdpConnection
  selectedHost: string
  clients: RawClientRecord[]
  paths: RawPathRecord[]
  filters: Required<MdpFilterConfig>
}) => {
  const clientLookup = new Map<string, MdpClientSummary>()
  const visibleClients: MdpClientSummary[] = []

  for (const client of params.clients) {
    const normalized: MdpClientSummary = {
      connectionKey: params.connection.key,
      clientId: toSyntheticClientId(params.connection.key, client.id),
      rawClientId: client.id,
      name: client.name,
      ...(client.description ? { description: client.description } : {}),
      ...(client.connectedAt ? { connectedAt: client.connectedAt } : {}),
      ...(client.lastSeenAt ? { lastSeenAt: client.lastSeenAt } : {}),
      ...(client.metadata ? { metadata: client.metadata } : {})
    }
    clientLookup.set(client.id, normalized)
    if (isVisibleMdpClient(normalized, params.filters)) {
      visibleClients.push(normalized)
    }
  }

  const visiblePaths: MdpPathSummary[] = []
  let hiddenPathCount = 0
  for (const path of params.paths) {
    const client = clientLookup.get(path.clientId)
    if (client == null) continue
    const normalized: MdpPathSummary = {
      connectionKey: params.connection.key,
      clientId: client.clientId,
      rawClientId: path.clientId,
      path: path.path,
      ...(path.type ? { type: path.type } : {}),
      ...(path.description ? { description: path.description } : {}),
      ...(path.methods ? { methods: path.methods } : {})
    }
    if (!isVisibleMdpPath(normalized, client, params.filters)) {
      hiddenPathCount++
      continue
    }
    visiblePaths.push(normalized)
  }

  return {
    connection: {
      key: params.connection.key,
      title: params.connection.title,
      selectedHost: params.selectedHost,
      hosts: params.connection.hosts,
      ok: true
    },
    clients: visibleClients,
    paths: visiblePaths,
    hidden: {
      clients: params.clients.length - visibleClients.length,
      paths: hiddenPathCount
    }
  }
}

const queryConnectionSummary = async (
  cwd: string,
  connection: ResolvedMdpConnection,
  filters: Required<MdpFilterConfig>
) => {
  try {
    const summary = canUseLocalBridgeApi(connection)
      ? await (async () => {
          const [clientResult, pathResult] = await Promise.all([
            callLocalBridgeApi<{ clients?: unknown[] }>({
              targetUrl: connection.hosts[0],
              request: { method: 'listClients' }
            }),
            callLocalBridgeApi<{ paths?: unknown[] }>({
              targetUrl: connection.hosts[0],
              request: { method: 'listPaths' }
            })
          ])
          const clients = (clientResult.clients ?? [])
            .map(toRawClientRecord)
            .filter((client): client is RawClientRecord => client != null)
          const paths = (pathResult.paths ?? [])
            .map(toRawPathRecord)
            .filter((path): path is RawPathRecord => path != null)
          return normalizeSummary({
            connection,
            selectedHost: connection.hosts[0],
            clients,
            paths,
            filters
          })
        })()
      : await withQueryWorker(cwd, connection, async (worker) => {
          const [clientResult, pathResult] = await Promise.all([
            worker.callTool<{ clients?: unknown[] }>('listClients'),
            worker.callTool<{ paths?: unknown[] }>('listPaths')
          ])
          const clients = (clientResult.clients ?? [])
            .map(toRawClientRecord)
            .filter((client): client is RawClientRecord => client != null)
          const paths = (pathResult.paths ?? [])
            .map(toRawPathRecord)
            .filter((path): path is RawPathRecord => path != null)
          return normalizeSummary({
            connection,
            selectedHost: worker.selectedHost,
            clients,
            paths,
            filters
          })
        })

    return await enrichSummaryFromLocalStateStore({
      cwd,
      connection,
      summary
    })
  } catch (error) {
    return {
      connection: {
        key: connection.key,
        title: connection.title,
        hosts: connection.hosts,
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      },
      clients: [],
      paths: [],
      hidden: {
        clients: 0,
        paths: 0
      }
    }
  }
}

export const collectMdpSummary = async (params: {
  cwd: string
  config?: Pick<Config, 'mdp'>
}): Promise<MdpSummaryResponse> => {
  const mdp = resolveMdpConfig(params.config)
  if (!mdp.enabled) {
    return {
      enabled: false,
      connections: [],
      clients: [],
      paths: [],
      hidden: {
        clients: 0,
        paths: 0
      }
    }
  }

  const results = await Promise.all(
    mdp.connections.map(connection => queryConnectionSummary(params.cwd, connection, mdp.filters))
  )

  const bridgeClientCount = results.reduce((sum, result) => sum + result.clients.length, 0)
  const bridgePathCount = results.reduce((sum, result) => sum + result.paths.length, 0)

  if (bridgeClientCount === 0 && bridgePathCount === 0 && mdp.connections.length === 1) {
    const fallback = await createLocalStateStoreSummary({
      cwd: params.cwd,
      connection: mdp.connections[0],
      filters: mdp.filters
    })
    if (fallback != null) {
      return {
        enabled: true,
        connections: [fallback.connection],
        clients: fallback.clients,
        paths: fallback.paths,
        hidden: fallback.hidden
      }
    }
  }

  return {
    enabled: true,
    connections: results.map(result => result.connection),
    clients: results.flatMap(result => result.clients),
    paths: results.flatMap(result => result.paths),
    hidden: {
      clients: results.reduce((sum, result) => sum + result.hidden.clients, 0),
      paths: results.reduce((sum, result) => sum + result.hidden.paths, 0)
    }
  }
}

const findConnection = (mdp: ResolvedMdpConfig, connectionKey: string) => (
  mdp.connections.find(connection => connection.key === connectionKey)
)

const assertVisibleClient = (
  summary: MdpSummaryResponse,
  clientId: string
) => {
  const client = summary.clients.find(item => item.clientId === clientId)
  if (client == null) {
    throw new Error(`Unknown or filtered MDP client "${clientId}"`)
  }
  return client
}

const findVisibleTargetClientIds = (
  summary: MdpSummaryResponse,
  method: HttpMethod,
  path: string
) => {
  const matchingClientIds = new Set(
    summary.paths
      .filter((item) => (
        item.path === path &&
        (item.methods == null || item.methods.length === 0 || item.methods.includes(method))
      ))
      .map(item => item.clientId)
  )

  return summary.clients.filter(client => matchingClientIds.has(client.clientId))
}

const hasVisibleClientPath = (
  summary: MdpSummaryResponse,
  clientId: string,
  method: HttpMethod,
  path: string
) => summary.paths.some(item => (
  item.clientId === clientId &&
  item.path === path &&
  (item.methods == null || item.methods.length === 0 || item.methods.includes(method))
))

const rewriteCallPathsResults = (
  connectionKey: string,
  results: unknown
) => {
  if (!isRecord(results) || !Array.isArray(results.results)) {
    return results
  }

  return {
    ...results,
    results: results.results.map((entry) => {
      if (!isRecord(entry) || typeof entry.clientId !== 'string') return entry
      return {
        ...entry,
        clientId: toSyntheticClientId(connectionKey, entry.clientId)
      }
    })
  }
}

export const createBridgeRequestHandler = (params: {
  cwd: string
  config?: Pick<Config, 'mdp'>
}): McpBridgeRequestHandler => {
  const resolvedConfig = resolveMdpConfig(params.config)

  return async (request: BridgeRequest) => {
    const summary = await collectMdpSummary({
      cwd: params.cwd,
      config: params.config
    })

    switch (request.method) {
      case 'listClients':
        return {
          clients: request.params?.search == null || request.params.search.trim() === ''
            ? summary.clients
            : summary.clients.filter(client => (
              client.clientId.includes(request.params!.search!) ||
              client.rawClientId.includes(request.params!.search!) ||
              client.name.includes(request.params!.search!)
            ))
        }
      case 'listPaths':
        return {
          paths: summary.paths.filter((path) => (
            (request.params?.clientId == null || path.clientId === request.params.clientId) &&
            (request.params?.search == null || request.params.search.trim() === '' || path.path.includes(request.params.search))
          ))
        }
      case 'callPath': {
        const targetClient = assertVisibleClient(summary, request.params.clientId)
        if (!hasVisibleClientPath(summary, targetClient.clientId, request.params.method, request.params.path)) {
          throw new Error(`MDP path "${request.params.path}" is hidden or unavailable for client "${targetClient.clientId}"`)
        }
        const parsedClientId = parseSyntheticClientId(targetClient.clientId)
        if (parsedClientId == null) {
          throw new Error(`Invalid MDP client id "${targetClient.clientId}"`)
        }
        const connection = findConnection(resolvedConfig, parsedClientId.connectionKey)
        if (connection == null) {
          throw new Error(`Unknown MDP connection "${parsedClientId.connectionKey}"`)
        }

        try {
          return canUseLocalBridgeApi(connection)
            ? await callLocalBridgeApi<MdpBridgeResponse>({
                targetUrl: connection.hosts[0],
                request: {
                  method: 'callPath',
                  params: {
                    ...request.params,
                    clientId: parsedClientId.rawClientId
                  }
                }
              })
            : await withQueryWorker(params.cwd, connection, async (worker) =>
                await worker.callTool('callPath', {
                  ...request.params,
                  clientId: parsedClientId.rawClientId
                }))
        } catch (error) {
          return {
            ok: false,
            error: {
              message: error instanceof Error ? error.message : String(error)
            }
          }
        }
      }
      case 'callPaths': {
        const targetClients = request.params.clientIds != null && request.params.clientIds.length > 0
          ? request.params.clientIds
            .map(clientId => assertVisibleClient(summary, clientId))
            .filter(client => hasVisibleClientPath(summary, client.clientId, request.params.method, request.params.path))
          : findVisibleTargetClientIds(summary, request.params.method, request.params.path)

        if (targetClients.length === 0) {
          throw new Error('No visible MDP clients matched the requested path')
        }

        const clientIdsByConnection = new Map<string, string[]>()
        for (const client of targetClients) {
          const parsedClientId = parseSyntheticClientId(client.clientId)
          if (parsedClientId == null) continue
          const current = clientIdsByConnection.get(parsedClientId.connectionKey) ?? []
          current.push(parsedClientId.rawClientId)
          clientIdsByConnection.set(parsedClientId.connectionKey, current)
        }

        const results = await Promise.all(
          Array.from(clientIdsByConnection.entries()).map(async ([connectionKey, rawClientIds]) => {
            const connection = findConnection(resolvedConfig, connectionKey)
            if (connection == null) {
              throw new Error(`Unknown MDP connection "${connectionKey}"`)
            }

            const response = canUseLocalBridgeApi(connection)
              ? await callLocalBridgeApi<MdpBridgeResponse>({
                  targetUrl: connection.hosts[0],
                  request: {
                    method: 'callPaths',
                    params: {
                      ...request.params,
                      clientIds: rawClientIds
                    }
                  }
                })
              : await withQueryWorker(params.cwd, connection, async (worker) =>
                  await worker.callTool('callPaths', {
                    ...request.params,
                    clientIds: rawClientIds
                  }))
            return rewriteCallPathsResults(connectionKey, response)
          })
        )

        return {
          results: results.flatMap((result) => (
            isRecord(result) && Array.isArray(result.results)
              ? result.results
              : []
          ))
        }
      }
    }
  }
}
