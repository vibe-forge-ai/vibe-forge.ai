import { getServerBaseUrl } from '#~/runtime-config'
import {
  clearAuthTokenForServerUrl,
  getAuthTokenForServerUrl,
  setAuthTokenForServerUrl
} from '#~/server-connection-history'

const LEGACY_AUTH_TOKEN_STORAGE_KEY = 'vf_auth_token'

const getStorage = () => {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

export const getAuthToken = () => {
  const serverUrl = getServerBaseUrl()
  const scopedToken = getAuthTokenForServerUrl(serverUrl)?.trim()
  if (scopedToken != null && scopedToken !== '') return scopedToken

  const legacyToken = getStorage()?.getItem(LEGACY_AUTH_TOKEN_STORAGE_KEY)?.trim()
  if (legacyToken == null || legacyToken === '') return undefined

  setAuthTokenForServerUrl(serverUrl, legacyToken)
  getStorage()?.removeItem(LEGACY_AUTH_TOKEN_STORAGE_KEY)
  return legacyToken
}

export const setAuthToken = (token: string) => {
  const normalized = token.trim()
  if (normalized === '') {
    return
  }
  setAuthTokenForServerUrl(getServerBaseUrl(), normalized)
  getStorage()?.removeItem(LEGACY_AUTH_TOKEN_STORAGE_KEY)
}

export const clearAuthToken = () => {
  clearAuthTokenForServerUrl(getServerBaseUrl())
  getStorage()?.removeItem(LEGACY_AUTH_TOKEN_STORAGE_KEY)
}

export const applyAuthHeader = (headers: Headers) => {
  const token = getAuthToken()
  if (token == null || headers.has('Authorization')) {
    return
  }
  headers.set('Authorization', `Bearer ${token}`)
}
