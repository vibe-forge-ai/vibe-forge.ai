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
})
