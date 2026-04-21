import { normalizeServerBaseUrl } from '#~/runtime-config'

export const SERVER_BASE_URL_HISTORY_STORAGE_KEY = 'vf_server_base_url_history'

export interface ServerConnectionProfile {
  serverUrl: string
  alias?: string
  description?: string
  authToken?: string
  serverVersion?: string
  createdAt: number
  lastConnectedAt: number
}

export interface ServerConnectionProfileDetails {
  alias?: string
  description?: string
}

const getStorage = () => {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

const normalizeOptionalText = (value: unknown) => {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized === '' ? undefined : normalized
}

const normalizeProfile = (value: unknown, fallbackTime: number): ServerConnectionProfile | undefined => {
  if (typeof value === 'string') {
    const serverUrl = normalizeServerBaseUrl(value)
    return serverUrl == null ? undefined : {
      serverUrl,
      createdAt: fallbackTime,
      lastConnectedAt: fallbackTime
    }
  }
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return undefined

  const record = value as Record<string, unknown>
  const serverUrl = normalizeServerBaseUrl(record.serverUrl as string | undefined)
  if (serverUrl == null) return undefined

  const createdAt = typeof record.createdAt === 'number' ? record.createdAt : fallbackTime
  const lastConnectedAt = typeof record.lastConnectedAt === 'number' ? record.lastConnectedAt : createdAt
  const alias = normalizeOptionalText(record.alias)
  const description = normalizeOptionalText(record.description)
  const authToken = normalizeOptionalText(record.authToken)
  const serverVersion = normalizeOptionalText(record.serverVersion)
  return {
    serverUrl,
    createdAt,
    lastConnectedAt,
    ...(alias != null ? { alias } : {}),
    ...(description != null ? { description } : {}),
    ...(authToken != null ? { authToken } : {}),
    ...(serverVersion != null ? { serverVersion } : {})
  }
}

const sortProfiles = (profiles: ServerConnectionProfile[]) => (
  [...profiles].sort((left, right) => right.lastConnectedAt - left.lastConnectedAt)
)

const saveProfiles = (profiles: ServerConnectionProfile[]) => {
  const normalizedProfiles = sortProfiles(profiles)
  getStorage()?.setItem(SERVER_BASE_URL_HISTORY_STORAGE_KEY, JSON.stringify(normalizedProfiles))
  return normalizedProfiles
}

export const getServerConnectionProfiles = () => {
  const raw = getStorage()?.getItem(SERVER_BASE_URL_HISTORY_STORAGE_KEY)
  if (raw == null || raw.trim() === '') return []

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    const profileByUrl = new Map<string, ServerConnectionProfile>()
    const fallbackTime = Date.now()
    for (const item of parsed) {
      const profile = normalizeProfile(item, fallbackTime)
      if (profile == null || profileByUrl.has(profile.serverUrl)) continue
      profileByUrl.set(profile.serverUrl, profile)
    }
    return sortProfiles(Array.from(profileByUrl.values()))
  } catch {
    return []
  }
}

export const getRecentServerBaseUrls = () => (
  getServerConnectionProfiles().map(profile => profile.serverUrl)
)

export const rememberServerBaseUrl = (value: string, details: { serverVersion?: string } = {}) => {
  const serverUrl = normalizeServerBaseUrl(value)
  if (serverUrl == null) return getServerConnectionProfiles()

  const now = Date.now()
  const profiles = getServerConnectionProfiles()
  const existing = profiles.find(profile => profile.serverUrl === serverUrl)
  const nextProfile: ServerConnectionProfile = {
    ...existing,
    serverUrl,
    createdAt: existing?.createdAt ?? now,
    lastConnectedAt: now,
    ...(normalizeOptionalText(details.serverVersion) != null
      ? { serverVersion: normalizeOptionalText(details.serverVersion) }
      : {})
  }
  return saveProfiles([
    nextProfile,
    ...profiles.filter(profile => profile.serverUrl !== serverUrl)
  ])
}

export const updateServerConnectionProfile = (serverUrl: string, details: ServerConnectionProfileDetails) => {
  const normalizedServerUrl = normalizeServerBaseUrl(serverUrl)
  if (normalizedServerUrl == null) return getServerConnectionProfiles()

  const now = Date.now()
  const profiles = getServerConnectionProfiles()
  const existing = profiles.find(profile => profile.serverUrl === normalizedServerUrl)
  const alias = normalizeOptionalText(details.alias)
  const description = normalizeOptionalText(details.description)
  const { alias: _alias, description: _description, ...existingProfile } = existing ?? {}
  return saveProfiles([
    {
      ...existingProfile,
      serverUrl: normalizedServerUrl,
      createdAt: existing?.createdAt ?? now,
      lastConnectedAt: existing?.lastConnectedAt ?? now,
      ...(alias != null ? { alias } : {}),
      ...(description != null ? { description } : {})
    },
    ...profiles.filter(profile => profile.serverUrl !== normalizedServerUrl)
  ])
}

export const removeServerConnectionProfile = (serverUrl: string) => {
  const normalizedServerUrl = normalizeServerBaseUrl(serverUrl)
  if (normalizedServerUrl == null) return getServerConnectionProfiles()
  return saveProfiles(getServerConnectionProfiles().filter(profile => profile.serverUrl !== normalizedServerUrl))
}

export const getAuthTokenForServerUrl = (serverUrl: string) => (
  getServerConnectionProfiles().find(profile => profile.serverUrl === normalizeServerBaseUrl(serverUrl))
    ?.authToken
)

export const setAuthTokenForServerUrl = (serverUrl: string, token: string) => {
  const normalizedToken = token.trim()
  if (normalizedToken === '') return

  const profiles = rememberServerBaseUrl(serverUrl)
  const normalizedServerUrl = normalizeServerBaseUrl(serverUrl)
  saveProfiles(
    profiles.map(profile =>
      profile.serverUrl === normalizedServerUrl ? { ...profile, authToken: normalizedToken } : profile
    )
  )
}

export const clearAuthTokenForServerUrl = (serverUrl: string) => {
  const normalizedServerUrl = normalizeServerBaseUrl(serverUrl)
  if (normalizedServerUrl == null) return getServerConnectionProfiles()
  return saveProfiles(
    getServerConnectionProfiles().map(profile => {
      if (profile.serverUrl !== normalizedServerUrl) return profile
      const { authToken: _authToken, ...nextProfile } = profile
      return nextProfile
    })
  )
}
