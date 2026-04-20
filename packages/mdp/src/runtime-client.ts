import type { ResolvedMdpConfig, ResolvedMdpConnection } from './config'

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export interface RuntimeClientInfo {
  id: string
  name: string
  description?: string
  metadata?: Record<string, JsonValue>
}

export interface RuntimeClientLike {
  expose(path: string, definition: unknown, handler?: (...args: any[]) => unknown): this
  connect(): Promise<void>
  register(overrides?: Record<string, unknown>): void
  disconnect(): Promise<void>
}

export interface RuntimeClientHandle<TClient extends RuntimeClientLike = RuntimeClientLike> {
  connection: ResolvedMdpConnection
  selectedHost: string
  client: TClient
}

export interface NormalizedRuntimeAuth {
  scheme?: string
  token?: string
  headers?: Record<string, string>
  metadata?: Record<string, JsonValue>
}

const normalizeJsonValue = (value: unknown): JsonValue | undefined => {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value == null
  ) {
    return value
  }

  if (Array.isArray(value)) {
    return value
      .map(item => normalizeJsonValue(item))
      .filter((item): item is JsonValue => item !== undefined)
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, item]) => [key, normalizeJsonValue(item)])
        .filter(([, item]) => item !== undefined)
    ) as JsonValue
  }

  return undefined
}

export const normalizeRuntimeAuth = (
  auth: ResolvedMdpConnection['auth']
): NormalizedRuntimeAuth | undefined => {
  if (auth == null) return undefined

  const normalizedMetadata = normalizeJsonValue(auth.metadata)
  return {
    ...(auth.scheme ? { scheme: auth.scheme } : {}),
    ...(auth.token ? { token: auth.token } : {}),
    ...(auth.headers ? { headers: auth.headers } : {}),
    ...(normalizedMetadata != null && !Array.isArray(normalizedMetadata) && typeof normalizedMetadata === 'object'
      ? { metadata: normalizedMetadata }
      : {})
  }
}

const createDeterministicDigest = (input: string) => {
  let hashA = 0x811c9dc5
  let hashB = 0x9e3779b9

  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index)
    hashA ^= code
    hashA = Math.imul(hashA, 0x01000193) >>> 0
    hashB ^= code + index
    hashB = Math.imul(hashB, 0x85ebca6b) >>> 0
  }

  return `${hashA.toString(16).padStart(8, '0')}${hashB.toString(16).padStart(8, '0')}`
}

export const buildRuntimeClientId = (parts: string[]) => (
  createDeterministicDigest(parts.join('\n')).slice(0, 12)
)

export const connectRuntimeClients = async <TClient extends RuntimeClientLike>(params: {
  mdp: ResolvedMdpConfig
  buildClientInfo: (connection: ResolvedMdpConnection) => RuntimeClientInfo
  configureClient: (client: TClient, connection: ResolvedMdpConnection) => void
  createClient: (options: {
    serverUrl: string
    client: RuntimeClientInfo
    auth?: NormalizedRuntimeAuth
  }) => TClient
  onConnectionError?: (connection: ResolvedMdpConnection, error: Error) => void
}) => {
  const handles: RuntimeClientHandle<TClient>[] = []
  if (!params.mdp.enabled) {
    return handles
  }

  for (const connection of params.mdp.connections) {
    let connected = false
    let lastError: Error | undefined

    for (const host of connection.hosts) {
      const client = params.createClient({
        serverUrl: host,
        client: params.buildClientInfo(connection),
        ...(normalizeRuntimeAuth(connection.auth) != null
          ? { auth: normalizeRuntimeAuth(connection.auth) }
          : {})
      })

      params.configureClient(client, connection)

      try {
        await client.connect()
        client.register()
        handles.push({
          connection,
          selectedHost: host,
          client
        })
        connected = true
        break
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        await client.disconnect().catch(() => {})
      }
    }

    if (!connected && lastError != null) {
      params.onConnectionError?.(connection, lastError)
    }
  }

  return handles
}

export const disconnectRuntimeClients = async (
  handles: RuntimeClientHandle[]
) => {
  await Promise.allSettled(handles.map(handle => handle.client.disconnect()))
}
