import { clearAuthToken } from './auth-token'
import { fetchApiJson, fetchApiJsonOrThrow, jsonHeaders } from './base'

export interface AuthStatus {
  enabled: boolean
  authenticated: boolean
  usernames: string[]
  passwordSource: 'config' | 'env' | 'generated'
  passwordFilePath?: string
  version?: string
  token?: string
}

export interface LoginInput {
  username: string
  password: string
  rememberDevice: boolean
  returnToken?: boolean
}

export const getAuthStatus = () => fetchApiJson<AuthStatus>('/api/auth/status')

export const login = (input: LoginInput) => (
  fetchApiJsonOrThrow<AuthStatus>(
    '/api/auth/login',
    {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(input)
    },
    '[api] login failed:'
  )
)

export const logout = async () => {
  const result = await fetchApiJsonOrThrow<{ ok: boolean }>(
    '/api/auth/logout',
    {
      method: 'POST',
      headers: jsonHeaders
    },
    '[api] logout failed:'
  )
  clearAuthToken()
  return result
}
