import { createMdpClient, type MdpClient } from '@modeldriveprotocol/client/browser'
import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useRef } from 'react'
import { matchPath, useLocation, useNavigate } from 'react-router-dom'
import useSWR from 'swr'

import type { ConfigResponse } from '@vibe-forge/types'
import {
  buildRuntimeClientId,
  connectRuntimeClients,
  disconnectRuntimeClients,
  resolveMdpConfig,
  type RuntimeClientHandle
} from '@vibe-forge/mdp/browser'

import { getConfig } from '#~/api'
import { runAiUiActionFeedback } from '#~/components/ai-ui-feedback/runtime'
import type { ChatHeaderView } from '#~/components/chat/ChatHeader'
import { getMdpChatRuntime } from '#~/hooks/mdp-browser-runtime/runtime-registry'
import {
  getBrowserInstanceId,
  resolveBrowserPageKey,
  stripClientBase,
  type BrowserPageKey
} from '#~/hooks/mdp-browser-runtime/browser-entry-context'
import { getClientBase } from '#~/runtime-config.js'
import { isMobileSidebarOpenAtom, isSidebarCollapsedAtom } from '#~/store/index'

const SESSION_ROUTE_PATTERN = '/session/:sessionId'

type JsonObject = Record<string, unknown>

interface BrowserUiState {
  activeSessionId?: string
  browserPathname: string
  config?: {
    detail: string
    source: string
    tab: string
  }
  href: string
  page: BrowserPageKey
  pathname: string
  search: string
  session: {
    activeView: ChatHeaderView
    isSettingsOpen: boolean
    isTerminalOpen: boolean
    isWorkspaceDrawerOpen: boolean
    openWorkspaceFilePaths: string[]
    selectedWorkspaceFilePath: string | null
  }
  sidebar: {
    isCollapsed: boolean
    isMobileOpen: boolean
  }
}

const asRecord = (value: unknown): JsonObject | undefined => (
  value != null &&
  typeof value === 'object' &&
  !Array.isArray(value)
    ? value as JsonObject
    : undefined
)

const asString = (value: unknown) => typeof value === 'string' ? value.trim() : ''

const normalizeChatView = (value: string | null | undefined): ChatHeaderView => {
  if (value === 'timeline' || value === 'settings' || value === 'history') {
    return value
  }
  return 'history'
}

const resolveRoutePath = (value: string) => {
  const normalized = value.trim()
  if (normalized === '') return ''

  switch (normalized) {
    case 'chat':
    case 'home':
      return '/'
    case 'archive':
      return '/archive'
    case 'automation':
      return '/automation'
    case 'benchmark':
      return '/benchmark'
    case 'config':
      return '/config'
    case 'knowledge':
      return '/knowledge'
    default:
      return normalized.startsWith('/') ? normalized : `/${normalized}`
  }
}

const buildSearchString = (value: unknown) => {
  if (typeof value === 'string') {
    const normalized = value.trim()
    if (normalized === '') return ''
    return normalized.startsWith('?') ? normalized : `?${normalized}`
  }

  const payload = asRecord(value)
  if (payload == null) {
    return ''
  }

  const search = new URLSearchParams()
  for (const [key, rawValue] of Object.entries(payload)) {
    if (rawValue == null || rawValue === '') {
      continue
    }

    if (Array.isArray(rawValue)) {
      for (const item of rawValue) {
        if (item == null || item === '') continue
        search.append(key, String(item))
      }
      continue
    }

    search.set(key, String(rawValue))
  }

  const serialized = search.toString()
  return serialized === '' ? '' : `?${serialized}`
}

const patchSearchString = (
  currentSearch: string,
  patch: Record<string, string | null | undefined>
) => {
  const nextSearch = new URLSearchParams(currentSearch)
  for (const [key, value] of Object.entries(patch)) {
    const normalized = value?.trim()
    if (normalized == null || normalized === '') {
      nextSearch.delete(key)
      continue
    }
    nextSearch.set(key, normalized)
  }
  const serialized = nextSearch.toString()
  return serialized === '' ? '' : `?${serialized}`
}

const resolveNavigationAnchor = (pathname: string) => {
  switch (pathname) {
    case '/':
      return 'navigation.chat'
    case '/archive':
      return 'navigation.archive'
    case '/automation':
      return 'navigation.automation'
    case '/benchmark':
      return 'navigation.benchmark'
    case '/config':
      return ['navigation.config', 'navigation.more']
    case '/knowledge':
      return 'navigation.knowledge'
    default:
      return undefined
  }
}

const buildRootSkillContent = () => [
  '# Browser UI Runtime',
  '',
  'This client controls the active Vibe Forge browser tab through semantic UI actions.',
  '',
  'Read `/state` first, then open the focused skill you need:',
  '- `/navigation/skill.md`',
  '- `/layout/skill.md`',
  '- `/session/skill.md`',
  '- `/panels/skill.md`'
].join('\n')

const buildNavigationSkillContent = () => [
  '# Navigation',
  '',
  'Use these routes for high-level page navigation. Do not send external URLs.',
  '',
  '- `POST /navigation/open`: open an internal route. Accepts `{ "path": "/config" }` or `{ "page": "knowledge" }`.',
  '- `POST /navigation/session/open`: open a specific session. Accepts `{ "sessionId": "...", "view": "settings" }`.',
  '- `POST /navigation/back`: navigate back in browser history.',
  '- `POST /config/open`: convenience alias for the config page.',
  '- `POST /config/section/open`: open a config tab. Accepts `{ "tab": "mdp", "source": "project", "detail": "" }`.',
  '- `POST /knowledge/open`, `POST /archive/open`, `POST /automation/open`, `POST /benchmark/open`: convenience page actions.'
].join('\n')

const buildLayoutSkillContent = () => [
  '# Layout',
  '',
  'Use these routes for global shell layout state.',
  '',
  '- `GET /layout/sidebar/state`: return desktop collapse state and mobile sheet state.',
  '- `POST /layout/sidebar/collapse`: collapse the desktop sidebar.',
  '- `POST /layout/sidebar/expand`: expand the desktop sidebar.',
  '- `POST /layout/sidebar/open-mobile`: open the compact mobile sidebar sheet.',
  '- `POST /layout/sidebar/close-mobile`: close the compact mobile sidebar sheet.'
].join('\n')

const buildSessionSkillContent = () => [
  '# Session View',
  '',
  'Use these routes when the active tab is on chat or session UI.',
  '',
  '- `GET /session/state`: return the active chat view, terminal state, workspace drawer state and file tabs.',
  '- `POST /session/view/set`: set `history`, `timeline` or `settings`.',
  '- `POST /session/settings/open`: switch the current session view to settings.',
  '- `POST /session/settings/close`: leave settings and return to history.'
].join('\n')

const buildPanelsSkillContent = () => [
  '# Panels',
  '',
  'Use these routes for terminal, workspace drawer and workspace file tabs.',
  '',
  '- `POST /panels/terminal/open`',
  '- `POST /panels/terminal/close`',
  '- `POST /panels/workspace/open`',
  '- `POST /panels/workspace/close`',
  '- `POST /panels/workspace/file/open`: accepts `{ "path": "..." }`.',
  '- `POST /panels/workspace/file/select`: accepts `{ "path": "..." }`.',
  '- `POST /panels/workspace/file/close`: optionally accepts `{ "path": "..." }`.'
].join('\n')

const getChatRuntimeState = (activeSessionId?: string) => {
  const runtime = getMdpChatRuntime()
  if (runtime == null) {
    return undefined
  }

  const runtimeState = runtime.getState()
  if ((runtimeState.sessionId ?? '') !== (activeSessionId ?? '')) {
    return undefined
  }
  return runtimeState
}

const buildUiState = (params: {
  isMobileSidebarOpen: boolean
  isSidebarCollapsed: boolean
  pathname: string
  search: string
}): BrowserUiState => {
  const sessionMatch = matchPath({ path: SESSION_ROUTE_PATTERN, end: true }, params.pathname)
  const activeSessionId = sessionMatch?.params.sessionId
  const searchParams = new URLSearchParams(params.search)
  const runtimeState = getChatRuntimeState(activeSessionId)

  return {
    activeSessionId,
    browserPathname: window.location.pathname,
    ...(params.pathname === '/config'
      ? {
        config: {
          detail: searchParams.get('detail') ?? '',
          source: searchParams.get('source') ?? 'project',
          tab: searchParams.get('tab') ?? 'general'
        }
      }
      : {}),
    href: window.location.href,
    page: resolveBrowserPageKey(params.pathname),
    pathname: params.pathname,
    search: params.search,
    session: {
      activeView: runtimeState?.activeView ?? normalizeChatView(searchParams.get('view')),
      isSettingsOpen: (runtimeState?.activeView ?? normalizeChatView(searchParams.get('view'))) === 'settings',
      isTerminalOpen: runtimeState?.isTerminalOpen ?? searchParams.get('terminal') === 'true',
      isWorkspaceDrawerOpen: runtimeState?.isWorkspaceDrawerOpen ?? searchParams.get('layout') === 'workspace',
      openWorkspaceFilePaths: runtimeState?.openWorkspaceFilePaths ?? [],
      selectedWorkspaceFilePath: runtimeState?.selectedWorkspaceFilePath ?? null
    },
    sidebar: {
      isCollapsed: params.isSidebarCollapsed,
      isMobileOpen: params.isMobileSidebarOpen
    }
  }
}

const buildBrowserMetadata = (state: BrowserUiState, connectionKey: string) => ({
  browserInstanceId: getBrowserInstanceId(),
  component: 'client',
  connectionKey,
  currentPage: state.page,
  currentRoute: state.pathname,
  currentSearch: state.search,
  currentSessionId: state.activeSessionId ?? null,
  sessionView: state.session.activeView,
  terminalOpen: state.session.isTerminalOpen,
  workspaceDrawerOpen: state.session.isWorkspaceDrawerOpen,
  sidebarCollapsed: state.sidebar.isCollapsed,
  mobileSidebarOpen: state.sidebar.isMobileOpen
})

const ensureView = (value: unknown) => {
  const view = asString(value)
  if (view !== 'history' && view !== 'timeline' && view !== 'settings') {
    throw new Error('view must be one of history, timeline or settings')
  }
  return view
}

export function useMdpBrowserRuntime() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: configRes } = useSWR<ConfigResponse>('/api/config', getConfig)
  const isSidebarCollapsed = useAtomValue(isSidebarCollapsedAtom)
  const isMobileSidebarOpen = useAtomValue(isMobileSidebarOpenAtom)
  const setIsMobileSidebarOpen = useSetAtom(isMobileSidebarOpenAtom)
  const handlesRef = useRef<RuntimeClientHandle<MdpClient>[]>([])
  const browserContextRef = useRef({
    isMobileSidebarOpen,
    isSidebarCollapsed,
    pathname: stripClientBase(location.pathname),
    search: location.search
  })
  const uiStateRef = useRef<BrowserUiState>(buildUiState(browserContextRef.current))

  browserContextRef.current = {
    isMobileSidebarOpen,
    isSidebarCollapsed,
    pathname: stripClientBase(location.pathname),
    search: location.search
  }
  const getCurrentUiState = () => buildUiState(browserContextRef.current)
  const uiState = getCurrentUiState()
  uiStateRef.current = uiState

  const navigateWithFeedback = async (
    anchorId: string | string[] | undefined,
    execute: () => Promise<unknown> | unknown
  ) => await runAiUiActionFeedback({ anchorId, execute })

  const openPath = async (pathname: string, search = '') => {
    await navigateWithFeedback(resolveNavigationAnchor(pathname), async () => {
      await navigate({ pathname, search })
    })
    return { ok: true, pathname, search }
  }

  const openConfig = async (payload?: JsonObject) => {
    const search = buildSearchString({
      ...(asString(payload?.tab) !== '' ? { tab: asString(payload?.tab) } : {}),
      ...(asString(payload?.source) !== '' ? { source: asString(payload?.source) } : {}),
      ...(asString(payload?.detail) !== '' ? { detail: asString(payload?.detail) } : {})
    })
    return await openPath('/config', search)
  }

  const openSessionRoute = async (sessionId: string, payload?: JsonObject) => {
    const search = patchSearchString('', {
      layout: payload?.workspaceDrawer === true ? 'workspace' : undefined,
      terminal: payload?.terminal === true ? 'true' : undefined,
      view: asString(payload?.view) || undefined
    })

    await navigateWithFeedback('session.title', async () => {
      await navigate({ pathname: `/session/${sessionId}`, search })
    })
    return {
      ok: true,
      pathname: `/session/${sessionId}`,
      search,
      sessionId
    }
  }

  const withCurrentSessionRuntime = () => {
    const runtime = getMdpChatRuntime()
    const runtimeState = runtime?.getState()
    const currentState = getCurrentUiState()
    if (runtime == null || runtimeState == null) {
      return undefined
    }
    if ((runtimeState.sessionId ?? '') !== (currentState.activeSessionId ?? '')) {
      return undefined
    }
    return runtime
  }

  useEffect(() => {
    const config = resolveMdpConfig(configRes?.sources?.merged)
    if (!config.enabled) {
      void disconnectRuntimeClients(handlesRef.current)
      handlesRef.current = []
      return
    }

    let cancelled = false
    const browserInstanceId = getBrowserInstanceId()

    void (async () => {
      const handles = await connectRuntimeClients<MdpClient>({
        mdp: config,
        buildClientInfo: (connection) => ({
          id: buildRuntimeClientId([
            'browser',
            connection.key,
            window.location.origin,
            browserInstanceId
          ]),
          name: 'Vibe Forge Browser',
          description: 'Active browser runtime for Vibe Forge UI',
          metadata: buildBrowserMetadata(getCurrentUiState(), connection.key)
        }),
        configureClient: (client) => {
          const setSessionView = async (payload: JsonObject | undefined, view: ChatHeaderView) => {
            const sessionId = asString(payload?.sessionId)
            const currentState = getCurrentUiState()
            const targetSessionId = sessionId || currentState.activeSessionId

            if (targetSessionId == null || targetSessionId === '') {
              throw new Error('sessionId is required when no session route is active')
            }

            if (targetSessionId === currentState.activeSessionId) {
              const runtime = withCurrentSessionRuntime()
              if (runtime != null) {
                await navigateWithFeedback(
                  view === 'settings' ? ['session.view.settings', 'session.view.menu'] : `session.view.${view}`,
                  () => {
                    runtime.setActiveView(view)
                  }
                )
                return { ok: true, sessionId: targetSessionId, view }
              }
            }

            return await openSessionRoute(targetSessionId, { view })
          }

          client.expose('/skill.md', buildRootSkillContent())
          client.expose('/state', {
            method: 'GET',
            description: 'Return current browser route, page and UI state.'
          }, () => getCurrentUiState())

          client.expose('/navigation/skill.md', buildNavigationSkillContent())
          client.expose('/navigation/open', {
            method: 'POST',
            description: 'Navigate the browser tab to an internal Vibe Forge route.'
          }, async ({ body }) => {
            const payload = asRecord(body)
            const path = resolveRoutePath(
              asString(payload?.path) ||
              asString(payload?.route) ||
              asString(payload?.page)
            )
            if (path === '') {
              throw new Error('path or page is required')
            }

            const search = buildSearchString(payload?.search)
            return await openPath(path, search)
          })
          client.expose('/navigation/session/open', {
            method: 'POST',
            description: 'Open a specific Vibe Forge session route.'
          }, async ({ body }) => {
            const payload = asRecord(body)
            const sessionId = asString(payload?.sessionId)
            if (sessionId === '') {
              throw new Error('sessionId is required')
            }
            return await openSessionRoute(sessionId, payload)
          })
          client.expose('/navigation/back', {
            method: 'POST',
            description: 'Go back one step in browser history.'
          }, async () => {
            await navigateWithFeedback(undefined, async () => {
              await navigate(-1)
            })
            return { ok: true }
          })

          client.expose('/layout/skill.md', buildLayoutSkillContent())
          client.expose('/layout/sidebar/state', {
            method: 'GET',
            description: 'Return current desktop and mobile sidebar state.'
          }, () => getCurrentUiState().sidebar)
          client.expose('/layout/sidebar/collapse', {
            method: 'POST',
            description: 'Collapse the desktop sidebar.'
          }, async () => {
            const currentState = getCurrentUiState()
            const search = patchSearchString(currentState.search, {
              sidebar: 'collapsed'
            })
            await navigateWithFeedback('layout.sidebar.collapse', async () => {
              await navigate({ pathname: currentState.pathname, search })
            })
            return { ok: true, search }
          })
          client.expose('/layout/sidebar/expand', {
            method: 'POST',
            description: 'Expand the desktop sidebar.'
          }, async () => {
            const currentState = getCurrentUiState()
            const search = patchSearchString(currentState.search, {
              sidebar: null
            })
            await navigateWithFeedback('layout.sidebar.collapse', async () => {
              await navigate({ pathname: currentState.pathname, search })
            })
            return { ok: true, search }
          })
          client.expose('/layout/sidebar/open-mobile', {
            method: 'POST',
            description: 'Open the mobile sidebar sheet in compact layout.'
          }, async () => {
            await navigateWithFeedback('layout.sidebar.mobile-toggle', () => {
              setIsMobileSidebarOpen(true)
            })
            return { ok: true }
          })
          client.expose('/layout/sidebar/close-mobile', {
            method: 'POST',
            description: 'Close the mobile sidebar sheet in compact layout.'
          }, async () => {
            await navigateWithFeedback(['layout.sidebar.mobile-close', 'layout.sidebar.mobile-toggle'], () => {
              setIsMobileSidebarOpen(false)
            })
            return { ok: true }
          })

          client.expose('/session/skill.md', buildSessionSkillContent())
          client.expose('/session/state', {
            method: 'GET',
            description: 'Return the current chat/session view state.'
          }, () => {
            const currentState = getCurrentUiState()
            return {
              sessionId: currentState.activeSessionId ?? null,
              ...currentState.session
            }
          })
          client.expose('/session/view/set', {
            method: 'POST',
            description: 'Set the current chat view to history, timeline or settings.'
          }, async ({ body }) => {
            const payload = asRecord(body)
            const view = ensureView(payload?.view)
            return await setSessionView(payload, view)
          })
          client.expose('/session/settings/open', {
            method: 'POST',
            description: 'Open session settings for the active session view.'
          }, async ({ body }) => {
            const payload = asRecord(body)
            return await setSessionView(payload, 'settings')
          })
          client.expose('/session/settings/close', {
            method: 'POST',
            description: 'Close session settings and return to history.'
          }, async ({ body }) => {
            const payload = asRecord(body)
            return await setSessionView(payload, 'history')
          })

          client.expose('/panels/skill.md', buildPanelsSkillContent())
          client.expose('/panels/terminal/open', {
            method: 'POST',
            description: 'Open the bottom terminal panel.'
          }, async () => {
            const runtime = withCurrentSessionRuntime()
            if (runtime != null) {
              await navigateWithFeedback('panels.terminal.toggle', () => {
                runtime.setTerminalOpen(true)
              })
              return { ok: true }
            }

            const currentState = getCurrentUiState()
            const pathname = currentState.activeSessionId == null ? '/' : `/session/${currentState.activeSessionId}`
            const search = patchSearchString(currentState.search, { terminal: 'true' })
            await navigateWithFeedback('panels.terminal.toggle', async () => {
              await navigate({ pathname, search })
            })
            return { ok: true, pathname, search }
          })
          client.expose('/panels/terminal/close', {
            method: 'POST',
            description: 'Close the bottom terminal panel.'
          }, async () => {
            const runtime = withCurrentSessionRuntime()
            if (runtime != null) {
              await navigateWithFeedback('panels.terminal.toggle', () => {
                runtime.setTerminalOpen(false)
              })
              return { ok: true }
            }

            const currentState = getCurrentUiState()
            const search = patchSearchString(currentState.search, { terminal: null })
            await navigateWithFeedback('panels.terminal.toggle', async () => {
              await navigate({ pathname: currentState.pathname, search })
            })
            return { ok: true, search }
          })
          client.expose('/panels/workspace/open', {
            method: 'POST',
            description: 'Open the workspace drawer.'
          }, async () => {
            const runtime = withCurrentSessionRuntime()
            if (runtime != null) {
              await navigateWithFeedback('panels.workspace.toggle', () => {
                runtime.setWorkspaceDrawerOpen(true)
              })
              return { ok: true }
            }

            const currentState = getCurrentUiState()
            const pathname = currentState.activeSessionId == null ? '/' : `/session/${currentState.activeSessionId}`
            const search = patchSearchString(currentState.search, { layout: 'workspace' })
            await navigateWithFeedback('panels.workspace.toggle', async () => {
              await navigate({ pathname, search })
            })
            return { ok: true, pathname, search }
          })
          client.expose('/panels/workspace/close', {
            method: 'POST',
            description: 'Close the workspace drawer.'
          }, async () => {
            const runtime = withCurrentSessionRuntime()
            if (runtime != null) {
              await navigateWithFeedback('panels.workspace.toggle', () => {
                runtime.setWorkspaceDrawerOpen(false)
              })
              return { ok: true }
            }

            const currentState = getCurrentUiState()
            const search = patchSearchString(currentState.search, { layout: null })
            await navigateWithFeedback('panels.workspace.toggle', async () => {
              await navigate({ pathname: currentState.pathname, search })
            })
            return { ok: true, search }
          })
          client.expose('/panels/workspace/file/open', {
            method: 'POST',
            description: 'Open a workspace file in the bottom editor panel.'
          }, async ({ body }) => {
            const payload = asRecord(body)
            const path = asString(payload?.path)
            if (path === '') {
              throw new Error('path is required')
            }

            const runtime = withCurrentSessionRuntime()
            if (runtime != null) {
              await navigateWithFeedback(['panels.workspace.file.panel', 'panels.workspace.drawer'], () => {
                runtime.openWorkspaceFile(path)
              })
              return { ok: true, path }
            }

            throw new Error('workspace file actions require an active chat/session view')
          })
          client.expose('/panels/workspace/file/select', {
            method: 'POST',
            description: 'Select an already open workspace file tab.'
          }, async ({ body }) => {
            const payload = asRecord(body)
            const path = asString(payload?.path)
            if (path === '') {
              throw new Error('path is required')
            }

            const runtime = withCurrentSessionRuntime()
            if (runtime == null) {
              throw new Error('workspace file actions require an active chat/session view')
            }

            await navigateWithFeedback(['panels.workspace.file.panel', 'panels.workspace.drawer'], () => {
              runtime.selectWorkspaceFile(path)
            })
            return { ok: true, path }
          })
          client.expose('/panels/workspace/file/close', {
            method: 'POST',
            description: 'Close the selected workspace file tab or a specific path.'
          }, async ({ body }) => {
            const payload = asRecord(body)
            const path = asString(payload?.path)
            const runtime = withCurrentSessionRuntime()
            if (runtime == null) {
              throw new Error('workspace file actions require an active chat/session view')
            }

            await navigateWithFeedback('panels.workspace.file.panel', () => {
              runtime.closeWorkspaceFile(path === '' ? undefined : path)
            })
            return { ok: true, ...(path === '' ? {} : { path }) }
          })

          client.expose('/config/open', {
            method: 'POST',
            description: 'Open the config page.'
          }, async ({ body }) => {
            const payload = asRecord(body)
            return await openConfig(payload)
          })
          client.expose('/config/section/open', {
            method: 'POST',
            description: 'Open a specific config tab and optional source/detail query.'
          }, async ({ body }) => {
            const payload = asRecord(body)
            if (asString(payload?.tab) === '') {
              throw new Error('tab is required')
            }
            return await openConfig(payload)
          })
          client.expose('/knowledge/open', {
            method: 'POST',
            description: 'Open the knowledge page.'
          }, async () => await openPath('/knowledge'))
          client.expose('/archive/open', {
            method: 'POST',
            description: 'Open the archived sessions page.'
          }, async () => await openPath('/archive'))
          client.expose('/automation/open', {
            method: 'POST',
            description: 'Open the automation page.'
          }, async () => await openPath('/automation'))
          client.expose('/benchmark/open', {
            method: 'POST',
            description: 'Open the benchmark page.'
          }, async () => await openPath('/benchmark'))
        },
        createClient: ({ serverUrl, client, auth }) => createMdpClient({
          serverUrl,
          client,
          ...(auth == null ? {} : { auth }),
          reconnect: {
            enabled: true
          }
        }),
        onConnectionError: (connection, error) => {
          console.warn(`[mdp] browser client failed for connection "${connection.key}"`, error)
        }
      })

      if (cancelled) {
        await disconnectRuntimeClients(handles)
        return
      }

      handlesRef.current = handles
    })()

    return () => {
      cancelled = true
      const currentHandles = handlesRef.current
      handlesRef.current = []
      void disconnectRuntimeClients(currentHandles)
    }
  }, [configRes?.sources?.merged, navigate, setIsMobileSidebarOpen])

  useEffect(() => {
    for (const handle of handlesRef.current) {
      handle.client.register({
        metadata: buildBrowserMetadata(uiState, handle.connection.key)
      })
    }
  }, [
    isMobileSidebarOpen,
    isSidebarCollapsed,
    location.pathname,
    location.search,
    uiState.activeSessionId,
    uiState.page,
    uiState.session.activeView,
    uiState.session.isTerminalOpen,
    uiState.session.isWorkspaceDrawerOpen
  ])
}
