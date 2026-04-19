export type RuntimeEnv = Partial<{
  __VF_PROJECT_AI_SERVER_BASE_URL__: string
  __VF_PROJECT_AI_SERVER_HOST__: string
  __VF_PROJECT_AI_SERVER_PORT__: string
  __VF_PROJECT_AI_SERVER_WS_PATH__: string
  __VF_PROJECT_AI_CLIENT_MODE__: string
  __VF_PROJECT_AI_CLIENT_BASE__: string
  __VF_PROJECT_AI_CLIENT_VERSION__: string
  __VF_PROJECT_AI_CLIENT_COMMIT_HASH__: string
}>

export const SERVER_BASE_URL_STORAGE_KEY = 'vf_server_base_url'
export const SERVER_CONNECTION_PICKER_STORAGE_KEY = 'vf_server_connection_picker_requested'

export const resolveDevDocumentTitle = (
  baseTitle: string,
  input: {
    isDev: boolean
    gitRef?: string
  }
) => {
  const normalizedBaseTitle = (baseTitle.trim() === '' ? 'Vibe Forge Web' : baseTitle.trim())
    .replace(/\s+\[[^\]]+\]$/, '')
  if (!input.isDev) {
    return normalizedBaseTitle
  }

  const gitRef = input.gitRef?.trim()
  if (gitRef == null || gitRef === '') {
    return normalizedBaseTitle
  }

  return `${normalizedBaseTitle} [${gitRef}]`
}

const getGlobalRuntimeEnv = () => {
  const globalScope = globalThis as { __VF_PROJECT_AI_RUNTIME_ENV__?: RuntimeEnv }
  return globalScope.__VF_PROJECT_AI_RUNTIME_ENV__
}

const pickNonEmptyValue = (...values: Array<string | undefined>) => (
  values.find((value) => typeof value === 'string' && value.trim() !== '')
)

const normalizeBase = (value?: string) => {
  let base = value?.trim() ?? '/ui'
  if (!base.startsWith('/')) {
    base = `/${base}`
  }
  if (base.length > 1 && base.endsWith('/')) {
    base = base.slice(0, -1)
  }
  return base
}

const normalizePath = (value?: string) => {
  let next = value?.trim() ?? ''
  if (!next) {
    return '/ws'
  }
  if (!next.startsWith('/')) {
    next = `/${next}`
  }
  return next
}

const normalizeServerHost = (value?: string) => {
  const next = value?.trim()
  if (next == null || next === '' || next === '0.0.0.0' || next === '::' || next === '[::]') {
    return undefined
  }
  return next
}

const hasUrlProtocol = (value: string) => /^[a-z][a-z\d+.-]*:\/\//i.test(value)

const getStorage = () => {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

const getBrowserProtocol = () => (
  globalThis.location?.protocol === 'https:' ? 'https' : 'http'
)

const getClientMode = () => (
  pickNonEmptyValue(
    getRuntimeEnv().__VF_PROJECT_AI_CLIENT_MODE__,
    import.meta.env.__VF_PROJECT_AI_CLIENT_MODE__,
    import.meta.env.__VF_PROJECT_AI_CLIENT_DEPLOY_MODE__
  )?.trim().toLowerCase()
)

export const normalizeServerBaseUrl = (value?: string) => {
  const trimmed = value?.trim() ?? ''
  if (trimmed === '') {
    return undefined
  }

  const rawUrl = hasUrlProtocol(trimmed) ? trimmed : `${getBrowserProtocol()}://${trimmed}`
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return undefined
    }
    url.hash = ''
    url.search = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return undefined
  }
}

export const createServerUrlFromBase = (baseUrl: string, path: string) => {
  const normalizedBaseUrl = normalizeServerBaseUrl(baseUrl)
  if (normalizedBaseUrl == null) {
    throw new Error('Invalid server base URL')
  }

  const relativePath = path.replace(/^\/+/, '')
  return new URL(relativePath, `${normalizedBaseUrl}/`).toString()
}

export const getStoredServerBaseUrl = () => (
  normalizeServerBaseUrl(getStorage()?.getItem(SERVER_BASE_URL_STORAGE_KEY) ?? undefined)
)

export const setStoredServerBaseUrl = (value: string) => {
  const normalized = normalizeServerBaseUrl(value)
  if (normalized == null) {
    return undefined
  }
  getStorage()?.setItem(SERVER_BASE_URL_STORAGE_KEY, normalized)
  return normalized
}

export const clearStoredServerBaseUrl = () => {
  getStorage()?.removeItem(SERVER_BASE_URL_STORAGE_KEY)
}

export const isStandaloneClientMode = () => {
  const mode = getClientMode()
  return mode === 'standalone' || mode === 'independent'
}

export const isDesktopClientMode = () => getClientMode() === 'desktop'

export const isServerConnectionManagedClientMode = () => {
  const mode = getClientMode()
  return mode === 'standalone' || mode === 'independent' || mode === 'desktop'
}

export const getRuntimeEnv = (): RuntimeEnv => getGlobalRuntimeEnv() ?? {}

export const resolveClientBase = (...values: Array<string | undefined>) => (
  normalizeBase(pickNonEmptyValue(...values))
)

export const getClientBase = () => (
  resolveClientBase(
    getRuntimeEnv().__VF_PROJECT_AI_CLIENT_BASE__,
    import.meta.env.__VF_PROJECT_AI_CLIENT_BASE__,
    import.meta.env.BASE_URL,
    '/ui'
  )
)

export const getServerHostEnv = () =>
  normalizeServerHost(
    getRuntimeEnv().__VF_PROJECT_AI_SERVER_HOST__ ??
      import.meta.env.__VF_PROJECT_AI_SERVER_HOST__
  )

export const getServerPortEnv = () =>
  getRuntimeEnv().__VF_PROJECT_AI_SERVER_PORT__ ??
    import.meta.env.__VF_PROJECT_AI_SERVER_PORT__

export const getConfiguredServerBaseUrl = () => {
  const configuredServerBaseUrl = normalizeServerBaseUrl(
    getRuntimeEnv().__VF_PROJECT_AI_SERVER_BASE_URL__ ??
      import.meta.env.__VF_PROJECT_AI_SERVER_BASE_URL__
  )
  if (configuredServerBaseUrl != null) {
    return configuredServerBaseUrl
  }

  const serverHost = getServerHostEnv()
  const serverPort = getServerPortEnv()?.trim()
  if (serverHost == null || serverPort == null || serverPort === '') {
    return undefined
  }

  return normalizeServerBaseUrl(`${serverHost}:${serverPort}`)
}

export const isServerConnectionPickerRequested = () => (
  getStorage()?.getItem(SERVER_CONNECTION_PICKER_STORAGE_KEY) === 'true'
)

export const requestServerConnectionPicker = (
  { clearCurrentServer = false }: { clearCurrentServer?: boolean } = {}
) => {
  if (clearCurrentServer) {
    clearStoredServerBaseUrl()
  }
  getStorage()?.setItem(SERVER_CONNECTION_PICKER_STORAGE_KEY, 'true')
}

export const clearServerConnectionPickerRequest = () => {
  getStorage()?.removeItem(SERVER_CONNECTION_PICKER_STORAGE_KEY)
}

export const getServerWsPath = () =>
  normalizePath(
    getRuntimeEnv().__VF_PROJECT_AI_SERVER_WS_PATH__ ?? import.meta.env.__VF_PROJECT_AI_SERVER_WS_PATH__
  )

export const getServerBaseUrl = () => {
  if (isServerConnectionManagedClientMode()) {
    const storedServerBaseUrl = getStoredServerBaseUrl()
    if (storedServerBaseUrl != null) {
      return storedServerBaseUrl
    }
  }

  const configuredServerBaseUrl = getConfiguredServerBaseUrl()
  if (configuredServerBaseUrl != null) {
    return configuredServerBaseUrl
  }

  const serverHost = getServerHostEnv() ?? globalThis.location?.hostname ?? 'localhost'
  const serverPort = getServerPortEnv() ?? '8787'
  return normalizeServerBaseUrl(`${serverHost}:${serverPort}`) ?? `${getBrowserProtocol()}://localhost:8787`
}

export const createServerUrl = (path: string) => createServerUrlFromBase(getServerBaseUrl(), path)
