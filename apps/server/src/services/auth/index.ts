import { resolve } from 'node:path'
import { env as processEnv } from 'node:process'

import type { ServerEnv } from '@vibe-forge/core'
import type { Config } from '@vibe-forge/types'

import { loadConfigState } from '#~/services/config/index.js'
import { logger } from '#~/utils/logger.js'

import { getAuthDataDir, isPasswordValid, readOrCreateSecretFile } from './session-token'

export {
  AUTH_COOKIE_NAME,
  clearAuthCookie,
  createSessionToken,
  getCookieFromHeader,
  setAuthCookie,
  verifySessionToken
} from './session-token'

const DEFAULT_SESSION_TTL_HOURS = 24 * 7
const DEFAULT_REMEMBER_DEVICE_TTL_DAYS = 30
const PASSWORD_FILE_NAME = 'web-auth-password'
export interface WebAuthConfig {
  enabled: boolean
  accounts: WebAuthAccount[]
  passwordSource: 'config' | 'env' | 'generated'
  passwordFilePath?: string
  sessionTtlMs: number
  rememberDeviceTtlMs: number
}

export interface WebAuthAccount {
  username: string
  password: string
}

const toBoolean = (value: unknown) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return undefined
}

const toPositiveNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }
  return undefined
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const isLocalServerHost = (host: string) => {
  const normalized = host.trim().toLowerCase()
  return normalized === '' ||
    normalized === 'localhost' ||
    normalized === '::1' ||
    normalized === '[::1]' ||
    normalized.startsWith('127.')
}

const resolveDefaultEnabled = (env: ServerEnv) => !isLocalServerHost(env.__VF_PROJECT_AI_SERVER_HOST__)

const normalizeConfiguredAccounts = (webAuth: Config['webAuth']) => {
  const accounts = Array.isArray(webAuth?.accounts)
    ? webAuth.accounts
      .filter(isRecord)
      .map((account) => ({
        username: typeof account.username === 'string' ? account.username.trim() : '',
        password: typeof account.password === 'string' ? account.password : ''
      }))
      .filter(account => account.username !== '' && account.password !== '')
    : []

  return accounts
}

let generatedPasswordPromise: Promise<{ password: string; path: string }> | undefined
let generatedPasswordLogged = false

const getGeneratedPassword = async (env: ServerEnv) => {
  const passwordPath = resolve(getAuthDataDir(env), PASSWORD_FILE_NAME)
  generatedPasswordPromise ??= readOrCreateSecretFile(passwordPath, 18)
    .then(password => ({ password, path: passwordPath }))
  const generated = await generatedPasswordPromise

  if (!generatedPasswordLogged) {
    generatedPasswordLogged = true
    logger.info(
      { passwordPath },
      '[auth] web auth is enabled and no password is configured; generated password file is ready'
    )
  }

  return generated
}

export const resolveWebAuthConfig = async (env: ServerEnv): Promise<WebAuthConfig> => {
  const { mergedConfig } = await loadConfigState()
  const webAuth = mergedConfig.webAuth
  const envEnabled = toBoolean(processEnv.__VF_PROJECT_AI_WEB_AUTH_ENABLED__)
  const enabled = envEnabled ?? toBoolean(webAuth?.enabled) ?? resolveDefaultEnabled(env)
  const sessionTtlHours = toPositiveNumber(processEnv.__VF_PROJECT_AI_WEB_AUTH_SESSION_TTL_HOURS__) ??
    toPositiveNumber(webAuth?.sessionTtlHours) ??
    DEFAULT_SESSION_TTL_HOURS
  const rememberDeviceTtlDays = toPositiveNumber(processEnv.__VF_PROJECT_AI_WEB_AUTH_REMEMBER_DEVICE_TTL_DAYS__) ??
    toPositiveNumber(webAuth?.rememberDeviceTtlDays) ??
    DEFAULT_REMEMBER_DEVICE_TTL_DAYS
  const envPassword = processEnv.__VF_PROJECT_AI_WEB_AUTH_PASSWORD?.trim()
  const configuredAccounts = normalizeConfiguredAccounts(webAuth)
  const configuredPassword = webAuth?.password?.trim()
  let accounts: WebAuthAccount[]
  let passwordSource: WebAuthConfig['passwordSource']
  let passwordFilePath: string | undefined

  if (envPassword != null && envPassword !== '') {
    accounts = [{
      username: processEnv.__VF_PROJECT_AI_WEB_AUTH_USERNAME?.trim() ||
        webAuth?.username?.trim() ||
        'admin',
      password: envPassword
    }]
    passwordSource = 'env'
  } else if (configuredAccounts.length > 0) {
    accounts = configuredAccounts
    passwordSource = 'config'
  } else if (configuredPassword != null && configuredPassword !== '') {
    accounts = [{
      username: webAuth?.username?.trim() || 'admin',
      password: configuredPassword
    }]
    passwordSource = 'config'
  } else if (enabled) {
    const generated = await getGeneratedPassword(env)
    accounts = [{
      username: webAuth?.username?.trim() || 'admin',
      password: generated.password
    }]
    passwordSource = 'generated'
    passwordFilePath = generated.path
  } else {
    accounts = [{ username: webAuth?.username?.trim() || 'admin', password: '' }]
    passwordSource = 'generated'
  }

  return {
    enabled,
    accounts,
    passwordSource,
    ...(passwordFilePath != null ? { passwordFilePath } : {}),
    sessionTtlMs: sessionTtlHours * 60 * 60 * 1000,
    rememberDeviceTtlMs: rememberDeviceTtlDays * 24 * 60 * 60 * 1000
  }
}

export const findMatchingAccount = (config: WebAuthConfig, username: string, password: string) => (
  config.accounts.find(account => account.username === username && isPasswordValid(password, account.password))
)

export const toAuthPublicStatus = (config: WebAuthConfig, authenticated: boolean) => ({
  enabled: config.enabled,
  authenticated: !config.enabled || authenticated,
  usernames: config.accounts.map(account => account.username),
  passwordSource: config.passwordSource,
  ...(config.passwordFilePath != null ? { passwordFilePath: config.passwordFilePath } : {})
})

export type AuthPublicStatus = ReturnType<typeof toAuthPublicStatus>
