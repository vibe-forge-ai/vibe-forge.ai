import { loadEnv } from '@vibe-forge/core'
import type { ChannelBaseConfig } from '@vibe-forge/core/channel'

import { tryCreateChannelActionToken } from './action-token'

const DEFAULT_CLIENT_BASE = '/ui/'

const normalizeClientBase = (value?: string) => {
  let base = value?.trim() || DEFAULT_CLIENT_BASE
  if (!base.startsWith('/')) {
    base = `/${base}`
  }
  if (!base.endsWith('/')) {
    base += '/'
  }
  return base.slice(0, -1)
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')

export const resolveChannelServerBaseUrl = (config?: ChannelBaseConfig) => {
  const env = loadEnv()
  const configuredBase = config?.serverBaseUrl?.trim()
  if (configuredBase != null && configuredBase !== '') {
    return trimTrailingSlash(configuredBase)
  }

  const publicBase = env.__VF_PROJECT_AI_PUBLIC_BASE_URL__?.trim()
  const origin = publicBase || `http://${env.__VF_PROJECT_AI_SERVER_HOST__}:${env.__VF_PROJECT_AI_SERVER_PORT__}`
  return trimTrailingSlash(origin)
}

export const resolveSessionDetailBaseUrl = (config?: ChannelBaseConfig) => {
  const env = loadEnv()
  const configuredBase = config?.sessionDetailBaseUrl?.trim()
  if (configuredBase != null && configuredBase !== '') {
    return trimTrailingSlash(configuredBase)
  }

  const normalizedOrigin = resolveChannelServerBaseUrl(config)
  const clientBase = normalizeClientBase(env.__VF_PROJECT_AI_CLIENT_BASE__)
  return normalizedOrigin.endsWith(clientBase)
    ? normalizedOrigin
    : `${normalizedOrigin}${clientBase}`
}

export const buildSessionDetailUrl = (
  config: ChannelBaseConfig | undefined,
  params: {
    sessionId: string
    toolUseId?: string
    messageId?: string
  }
) => {
  const baseUrl = resolveSessionDetailBaseUrl(config)
  const url = new URL(`${baseUrl}/session/${encodeURIComponent(params.sessionId)}`)
  if (params.toolUseId?.trim()) {
    url.searchParams.set('toolUseId', params.toolUseId.trim())
  }
  if (params.messageId?.trim()) {
    url.searchParams.set('messageId', params.messageId.trim())
  }
  return url.toString()
}

export const buildToolCallDetailUrl = (
  config: ChannelBaseConfig | undefined,
  params: {
    sessionId: string
    toolUseId: string
    messageId?: string
  }
) => {
  const baseUrl = resolveChannelServerBaseUrl(config)
  const token = tryCreateChannelActionToken({
    action: 'tool-call-detail',
    sessionId: params.sessionId,
    sessionUrl: buildSessionDetailUrl(config, params),
    toolUseId: params.toolUseId,
    messageId: params.messageId
  })
  if (token == null) {
    return undefined
  }
  const url = new URL(`${baseUrl}/channels/actions/tool-call-detail`)
  url.searchParams.set('token', token)
  return url.toString()
}

export const buildChannelActionUrl = (
  config: ChannelBaseConfig | undefined,
  params: {
    action: string
    sessionId: string
    toolUseId?: string
    messageId?: string
  }
) => {
  const action = params.action.trim()
  const baseUrl = resolveChannelServerBaseUrl(config)
  const token = tryCreateChannelActionToken({
    action,
    sessionId: params.sessionId,
    toolUseId: params.toolUseId,
    messageId: params.messageId,
    oneTime: action === 'tool-call-export'
  })
  if (token == null) {
    return undefined
  }
  const url = new URL(`${baseUrl}/channels/actions/${encodeURIComponent(action)}`)
  url.searchParams.set('token', token)
  return url.toString()
}
