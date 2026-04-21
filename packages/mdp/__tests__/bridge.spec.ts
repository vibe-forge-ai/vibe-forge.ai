import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { collectMdpSummary, createBridgeRequestHandler } from '../src/bridge'

describe('collectMdpSummary', () => {
  const tempRoots: string[] = []

  afterEach(() => {
    vi.unstubAllEnvs()
    return Promise.allSettled(tempRoots.splice(0).map(async (root) => {
      await rm(root, { recursive: true, force: true })
    }))
  })

  it('falls back to the launch workspace state store when the current cwd is a session worktree', async () => {
    const root = await mkdtemp(join(tmpdir(), 'vf-mdp-bridge-'))
    tempRoots.push(root)
    const launchWorkspace = join(root, 'launch-workspace')
    const sessionWorkspace = join(root, 'session-worktree')
    const storeDir = join(launchWorkspace, '.logs', 'mdp-state')

    await mkdir(storeDir, { recursive: true })
    await mkdir(sessionWorkspace, { recursive: true })
    await writeFile(join(storeDir, 'clients.json'), JSON.stringify([
      {
        id: 'browser-1',
        name: 'Vibe Forge Browser',
        status: 'online',
        connectedAt: '2026-04-20T12:00:00.000Z',
        lastSeenAt: '2026-04-20T12:00:01.000Z',
        metadata: {
          currentRoute: '/config'
        },
        paths: [
          {
            path: '/state',
            type: 'endpoint',
            method: 'GET',
            description: 'Read browser state.'
          }
        ]
      }
    ], null, 2))

    vi.stubEnv('__VF_PROJECT_LAUNCH_CWD__', resolve(launchWorkspace))
    vi.stubEnv('__VF_PROJECT_WORKSPACE_FOLDER__', resolve(sessionWorkspace))
    vi.stubEnv('__VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__', resolve(launchWorkspace))

    const summary = await collectMdpSummary({
      cwd: sessionWorkspace,
      config: {
        mdp: {
          enabled: true,
          connections: {
            default: {
              hosts: ['ws://127.0.0.1:9']
            }
          }
        }
      }
    })

    expect(summary.enabled).toBe(true)
    expect(summary.clients).toEqual([
      expect.objectContaining({
        connectionKey: 'default',
        clientId: 'default::browser-1',
        rawClientId: 'browser-1',
        name: 'Vibe Forge Browser',
        connectedAt: '2026-04-20T12:00:00.000Z',
        lastSeenAt: '2026-04-20T12:00:01.000Z'
      })
    ])
    expect(summary.paths).toEqual([
      expect.objectContaining({
        connectionKey: 'default',
        clientId: 'default::browser-1',
        rawClientId: 'browser-1',
        path: '/state',
        methods: ['GET']
      })
    ])
  })

  it('falls back to localhost when the local bridge default host is unreachable', async () => {
    const root = await mkdtemp(join(tmpdir(), 'vf-mdp-bridge-'))
    tempRoots.push(root)
    const storeDir = join(root, '.logs', 'mdp-state')

    await mkdir(storeDir, { recursive: true })
    await writeFile(join(storeDir, 'clients.json'), JSON.stringify([
      {
        id: 'browser-1',
        name: 'Vibe Forge Browser',
        status: 'online',
        paths: [
          {
            path: '/layout/sidebar/collapse',
            type: 'endpoint',
            method: 'POST',
            description: 'Collapse the desktop sidebar.'
          }
        ]
      }
    ], null, 2))

    vi.stubEnv('__VF_PROJECT_AI_SERVER_HOST__', '127.0.0.1')
    vi.stubEnv('__VF_PROJECT_AI_SERVER_PORT__', '8787')

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      if (url.startsWith('http://127.0.0.1:8787')) {
        throw new TypeError('fetch failed')
      }

      expect(url).toBe('http://localhost:8787/api/mdp/bridge')
      return new Response(JSON.stringify({
        success: true,
        data: {
          ok: true,
          data: {
            ok: true,
            search: '?sidebar=collapsed'
          }
        }
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const handler = createBridgeRequestHandler({
      cwd: root,
      config: {
        mdp: {
          enabled: true,
          connections: {
            default: {
              hosts: ['ws://127.0.0.1:47372']
            }
          }
        }
      }
    })

    const result = await handler({
      method: 'callPath',
      params: {
        clientId: 'default::browser-1',
        method: 'POST',
        path: '/layout/sidebar/collapse'
      }
    })

    expect(result).toEqual({
      ok: true,
      data: {
        ok: true,
        search: '?sidebar=collapsed'
      }
    })
    const requestedUrls = fetchMock.mock.calls.map(([input]) => (
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    ))
    expect(requestedUrls).toContain('http://127.0.0.1:8787/api/mdp/bridge')
    expect(requestedUrls).toContain('http://localhost:8787/api/mdp/bridge')
  })

  it('normalizes JSON string bodies before forwarding callPath requests', async () => {
    const root = await mkdtemp(join(tmpdir(), 'vf-mdp-bridge-'))
    tempRoots.push(root)
    const storeDir = join(root, '.logs', 'mdp-state')

    await mkdir(storeDir, { recursive: true })
    await writeFile(join(storeDir, 'clients.json'), JSON.stringify([
      {
        id: 'browser-1',
        name: 'Vibe Forge Browser',
        status: 'online',
        paths: [
          {
            path: '/navigation/session/open',
            type: 'endpoint',
            method: 'POST',
            description: 'Open a specific Vibe Forge session route.'
          }
        ]
      }
    ], null, 2))

    vi.stubEnv('__VF_PROJECT_AI_SERVER_HOST__', 'localhost')
    vi.stubEnv('__VF_PROJECT_AI_SERVER_PORT__', '8787')

    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const rawBody = typeof init?.body === 'string' ? init.body : ''
      const parsedBody = JSON.parse(rawBody) as {
        request: {
          method: string
          params: {
            clientId: string
            method: string
            path: string
            body: {
              sessionId: string
            }
          }
        }
      }

      expect(parsedBody.request.method).toBe('callPath')
      expect(parsedBody.request.params.clientId).toBe('browser-1')
      expect(parsedBody.request.params.path).toBe('/navigation/session/open')
      expect(parsedBody.request.params.body).toEqual({
        sessionId: 'session-123'
      })

      return new Response(JSON.stringify({
        success: true,
        data: {
          ok: true,
          data: {
            ok: true,
            sessionId: 'session-123'
          }
        }
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const handler = createBridgeRequestHandler({
      cwd: root,
      config: {
        mdp: {
          enabled: true,
          connections: {
            default: {
              hosts: ['ws://127.0.0.1:47372']
            }
          }
        }
      }
    })

    const result = await handler({
      method: 'callPath',
      params: {
        clientId: 'default::browser-1',
        method: 'POST',
        path: '/navigation/session/open',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: 'session-123'
        })
      }
    })

    expect(result).toEqual({
      ok: true,
      data: {
        ok: true,
        sessionId: 'session-123'
      }
    })
  })

  it('returns a server handoff hint when browser-scoped listPaths finds no match', async () => {
    const root = await mkdtemp(join(tmpdir(), 'vf-mdp-bridge-'))
    tempRoots.push(root)
    const storeDir = join(root, '.logs', 'mdp-state')

    await mkdir(storeDir, { recursive: true })
    await writeFile(join(storeDir, 'clients.json'), JSON.stringify([
      {
        id: 'browser-1',
        name: 'Vibe Forge Browser',
        status: 'online',
        paths: [
          {
            path: '/layout/sidebar/collapse',
            type: 'endpoint',
            method: 'POST',
            description: 'Collapse the desktop sidebar.'
          }
        ]
      }
    ], null, 2))

    const handler = createBridgeRequestHandler({
      cwd: root,
      config: {
        mdp: {
          enabled: true,
          connections: {
            default: {
              hosts: ['ws://127.0.0.1:9']
            }
          }
        }
      }
    })

    const result = await handler({
      method: 'listPaths',
      params: {
        clientId: 'default::browser-1',
        search: 'create message send'
      }
    })

    expect(result).toEqual({
      paths: [],
      hint: expect.stringContaining('switch to the `Vibe Forge Server` client')
    })
  })

  it('filters listPaths correctly when the request uses clientIds', async () => {
    const root = await mkdtemp(join(tmpdir(), 'vf-mdp-bridge-'))
    tempRoots.push(root)
    const storeDir = join(root, '.logs', 'mdp-state')

    await mkdir(storeDir, { recursive: true })
    await writeFile(join(storeDir, 'clients.json'), JSON.stringify([
      {
        id: 'browser-1',
        name: 'Vibe Forge Browser',
        status: 'online',
        paths: [
          {
            path: '/navigation/session/open',
            type: 'endpoint',
            method: 'POST',
            description: 'Open one session.'
          }
        ]
      },
      {
        id: 'server-1',
        name: 'Vibe Forge Server',
        status: 'online',
        paths: [
          {
            path: '/sessions/create',
            type: 'endpoint',
            method: 'POST',
            description: 'Create one session.'
          }
        ]
      }
    ], null, 2))

    const handler = createBridgeRequestHandler({
      cwd: root,
      config: {
        mdp: {
          enabled: true,
          connections: {
            default: {
              hosts: ['ws://127.0.0.1:9']
            }
          }
        }
      }
    })

    const result = await handler({
      method: 'listPaths',
      params: {
        clientIds: ['default::browser-1']
      }
    } as Parameters<typeof handler>[0])

    expect(result).toEqual({
      paths: [
        expect.objectContaining({
          clientId: 'default::browser-1',
          path: '/navigation/session/open'
        })
      ]
    })
  })

  it('sorts listClients results so workspace projection clients come last', async () => {
    const root = await mkdtemp(join(tmpdir(), 'vf-mdp-bridge-'))
    tempRoots.push(root)
    const storeDir = join(root, '.logs', 'mdp-state')

    await mkdir(storeDir, { recursive: true })
    await writeFile(join(storeDir, 'clients.json'), JSON.stringify([
      {
        id: 'workspace-1',
        name: 'Vibe Forge Workspace',
        status: 'online',
        paths: []
      },
      {
        id: 'server-1',
        name: 'Vibe Forge Server',
        status: 'online',
        paths: []
      },
      {
        id: 'browser-1',
        name: 'Vibe Forge Browser',
        status: 'online',
        paths: []
      }
    ], null, 2))

    const handler = createBridgeRequestHandler({
      cwd: root,
      config: {
        mdp: {
          enabled: true,
          connections: {
            default: {
              hosts: ['ws://127.0.0.1:9']
            }
          }
        }
      }
    })

    const result = await handler({
      method: 'listClients'
    })

    expect(result).toEqual({
      clients: [
        expect.objectContaining({ clientId: 'default::browser-1' }),
        expect.objectContaining({ clientId: 'default::server-1' }),
        expect.objectContaining({ clientId: 'default::workspace-1' })
      ]
    })
  })

  it('sorts listPaths results so skill paths lead scoped discovery', async () => {
    const root = await mkdtemp(join(tmpdir(), 'vf-mdp-bridge-'))
    tempRoots.push(root)
    const storeDir = join(root, '.logs', 'mdp-state')

    await mkdir(storeDir, { recursive: true })
    await writeFile(join(storeDir, 'clients.json'), JSON.stringify([
      {
        id: 'server-1',
        name: 'Vibe Forge Server',
        status: 'online',
        paths: [
          {
            path: '/sessions/create',
            type: 'endpoint',
            method: 'POST'
          },
          {
            path: '/sessions/skill.md',
            type: 'skill'
          },
          {
            path: '/skill.md',
            type: 'skill'
          },
          {
            path: '/sessions/state',
            type: 'endpoint',
            method: 'GET'
          }
        ]
      }
    ], null, 2))

    const handler = createBridgeRequestHandler({
      cwd: root,
      config: {
        mdp: {
          enabled: true,
          connections: {
            default: {
              hosts: ['ws://127.0.0.1:9']
            }
          }
        }
      }
    })

    const result = await handler({
      method: 'listPaths',
      params: {
        clientId: 'default::server-1'
      }
    })

    expect(result).toEqual({
      paths: [
        expect.objectContaining({ path: '/skill.md' }),
        expect.objectContaining({ path: '/sessions/skill.md' }),
        expect.objectContaining({ path: '/sessions/state' }),
        expect.objectContaining({ path: '/sessions/create' })
      ]
    })
  })

  it('accepts concrete request paths for parameterized server endpoints', async () => {
    const root = await mkdtemp(join(tmpdir(), 'vf-mdp-bridge-'))
    tempRoots.push(root)
    const storeDir = join(root, '.logs', 'mdp-state')

    await mkdir(storeDir, { recursive: true })
    await writeFile(join(storeDir, 'clients.json'), JSON.stringify([
      {
        id: 'server-1',
        name: 'Vibe Forge Server',
        status: 'online',
        paths: [
          {
            path: '/sessions/:session_id/messages',
            type: 'endpoint',
            method: 'GET',
            description: 'Inspect one session message list.'
          }
        ]
      }
    ], null, 2))

    vi.stubEnv('__VF_PROJECT_AI_SERVER_HOST__', 'localhost')
    vi.stubEnv('__VF_PROJECT_AI_SERVER_PORT__', '8787')

    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const rawBody = typeof init?.body === 'string' ? init.body : ''
      const parsedBody = JSON.parse(rawBody) as {
        request: {
          method: string
          params: {
            clientId: string
            method: string
            path: string
          }
        }
      }

      expect(parsedBody.request.method).toBe('callPath')
      expect(parsedBody.request.params.clientId).toBe('server-1')
      expect(parsedBody.request.params.path).toBe('/sessions/session-123/messages')

      return new Response(JSON.stringify({
        success: true,
        data: {
          ok: true,
          data: {
            messages: []
          }
        }
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const handler = createBridgeRequestHandler({
      cwd: root,
      config: {
        mdp: {
          enabled: true,
          connections: {
            default: {
              hosts: ['ws://127.0.0.1:47372']
            }
          }
        }
      }
    })

    const result = await handler({
      method: 'callPath',
      params: {
        clientId: 'default::server-1',
        method: 'GET',
        path: '/sessions/session-123/messages'
      }
    })

    expect(result).toEqual({
      ok: true,
      data: {
        messages: []
      }
    })
  })

  it('does not retry non-idempotent callPath requests after a timeout', async () => {
    const root = await mkdtemp(join(tmpdir(), 'vf-mdp-bridge-'))
    tempRoots.push(root)
    const storeDir = join(root, '.logs', 'mdp-state')

    await mkdir(storeDir, { recursive: true })
    await writeFile(join(storeDir, 'clients.json'), JSON.stringify([
      {
        id: 'server-1',
        name: 'Vibe Forge Server',
        status: 'online',
        paths: [
          {
            path: '/sessions/create',
            type: 'endpoint',
            method: 'POST',
            description: 'Create a new session.'
          }
        ]
      }
    ], null, 2))

    vi.stubEnv('__VF_PROJECT_AI_SERVER_HOST__', 'localhost')
    vi.stubEnv('__VF_PROJECT_AI_SERVER_PORT__', '8787')

    const callPathUrls: string[] = []
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const rawBody = typeof init?.body === 'string' ? init.body : ''
      const parsedBody = rawBody === ''
        ? undefined
        : JSON.parse(rawBody) as { request?: { method?: string } }

      if (parsedBody?.request?.method === 'callPath') {
        callPathUrls.push(url)
      }

      throw new Error('The operation was aborted due to timeout')
    })
    vi.stubGlobal('fetch', fetchMock)

    const handler = createBridgeRequestHandler({
      cwd: root,
      config: {
        mdp: {
          enabled: true,
          connections: {
            default: {
              hosts: ['ws://127.0.0.1:47372']
            }
          }
        }
      }
    })

    const result = await handler({
      method: 'callPath',
      params: {
        clientId: 'default::server-1',
        method: 'POST',
        path: '/sessions/create',
        body: {
          initialMessage: 'hello'
        }
      }
    })

    expect(result).toEqual({
      ok: false,
      error: {
        message: 'The operation was aborted due to timeout'
      }
    })
    expect(callPathUrls).toEqual(['http://localhost:8787/api/mdp/bridge'])
  })
})
