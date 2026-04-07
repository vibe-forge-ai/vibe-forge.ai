import { loadEnv } from '@vibe-forge/core'
import type { ChannelBaseConfig } from '@vibe-forge/core/channel'

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
  const url = new URL(`${baseUrl}/channels/actions/tool-call-detail`)
  url.searchParams.set('sessionId', params.sessionId)
  url.searchParams.set('toolUseId', params.toolUseId)
  if (params.messageId?.trim()) {
    url.searchParams.set('messageId', params.messageId.trim())
  }
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
  const url = new URL(`${baseUrl}/channels/actions/${encodeURIComponent(action)}`)
  url.searchParams.set('sessionId', params.sessionId)
  if (params.toolUseId?.trim()) {
    url.searchParams.set('toolUseId', params.toolUseId.trim())
  }
  if (params.messageId?.trim()) {
    url.searchParams.set('messageId', params.messageId.trim())
  }
  return url.toString()
}
