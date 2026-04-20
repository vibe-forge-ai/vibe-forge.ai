import { matchPath } from 'react-router-dom'

import type { Config, SessionEntryContext, SessionEntryMdpClientRef } from '@vibe-forge/types'
import { buildRuntimeClientId, resolveMdpConfig } from '@vibe-forge/mdp/browser'

import { getClientBase } from '#~/runtime-config.js'

const SESSION_ROUTE_PATTERN = '/session/:sessionId'
const BROWSER_INSTANCE_STORAGE_KEY = 'vf_mdp_browser_instance_id'

export type BrowserPageKey =
  | 'archive'
  | 'automation'
  | 'benchmark'
  | 'chat'
  | 'config'
  | 'knowledge'
  | 'session'
  | 'unknown'

export const getBrowserInstanceId = () => {
  const existing = window.sessionStorage.getItem(BROWSER_INSTANCE_STORAGE_KEY)?.trim()
  if (existing) {
    return existing
  }

  const nextId = globalThis.crypto?.randomUUID?.() ?? `vf-browser-${Date.now()}`
  window.sessionStorage.setItem(BROWSER_INSTANCE_STORAGE_KEY, nextId)
  return nextId
}

export const stripClientBase = (pathname: string) => {
  const base = getClientBase()
  if (base !== '/' && pathname.startsWith(base)) {
    const nextPath = pathname.slice(base.length)
    return nextPath.startsWith('/') ? nextPath : `/${nextPath}`
  }
  return pathname
}

export const resolveBrowserPageKey = (pathname: string): BrowserPageKey => {
  if (pathname === '/') return 'chat'
  if (pathname.startsWith('/session/')) return 'session'
  if (pathname === '/archive') return 'archive'
  if (pathname === '/automation') return 'automation'
  if (pathname === '/benchmark') return 'benchmark'
  if (pathname === '/config') return 'config'
  if (pathname === '/knowledge') return 'knowledge'
  return 'unknown'
}

export const buildBrowserEntryMdpRefs = (config: Pick<Config, 'mdp'> | undefined): SessionEntryMdpClientRef[] => {
  const mdp = resolveMdpConfig(config)
  if (!mdp.enabled) {
    return []
  }

  const browserInstanceId = getBrowserInstanceId()
  return mdp.connections.map((connection) => {
    const rawClientId = buildRuntimeClientId([
      'browser',
      connection.key,
      window.location.origin,
      browserInstanceId
    ])
    return {
      connectionKey: connection.key,
      clientId: `${connection.key}::${rawClientId}`,
      rawClientId
    }
  })
}

export const buildBrowserSessionEntryContext = (params: {
  pathname: string
  search: string
  href: string
  config?: Pick<Config, 'mdp'>
}): SessionEntryContext => {
  const sessionMatch = matchPath({ path: SESSION_ROUTE_PATTERN, end: true }, params.pathname)

  return {
    kind: 'browser',
    page: resolveBrowserPageKey(params.pathname),
    route: params.pathname,
    ...(params.search.trim() === '' ? {} : { search: params.search }),
    ...(params.href.trim() === '' ? {} : { href: params.href }),
    ...(sessionMatch?.params.sessionId == null ? {} : { activeSessionId: sessionMatch.params.sessionId }),
    ...(buildBrowserEntryMdpRefs(params.config).length === 0
      ? {}
      : { mdp: { refs: buildBrowserEntryMdpRefs(params.config) } })
  }
}
