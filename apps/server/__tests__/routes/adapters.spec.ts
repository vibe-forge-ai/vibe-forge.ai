import { mkdtemp, readFile, rm } from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

import Router from '@koa/router'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { adaptersRouter } from '#~/routes/adapters.js'

const mocks = vi.hoisted(() => ({
  loadConfigState: vi.fn(),
  loadAdapter: vi.fn()
}))

vi.mock('#~/services/config/index.js', () => ({
  loadConfigState: mocks.loadConfigState
}))

vi.mock('@vibe-forge/types', () => ({
  loadAdapter: mocks.loadAdapter
}))

describe('adapter routes', () => {
  let workspaceFolder = ''
  let server: http.Server | undefined
  let baseUrl = ''

  beforeEach(async () => {
    workspaceFolder = await mkdtemp(path.join(os.tmpdir(), 'vf-adapter-routes-'))

    const app = new Koa()
    const rootRouter = new Router({ prefix: '/api/adapters' })
    const router = adaptersRouter()
    rootRouter.use(router.routes())
    rootRouter.use(router.allowedMethods())
    app.use(bodyParser())
    app.use(rootRouter.routes())
    app.use(rootRouter.allowedMethods())

    server = http.createServer(app.callback())
    await new Promise<void>((resolve) => {
      server!.listen(0, '127.0.0.1', () => resolve())
    })
    const address = server.address()
    if (address == null || typeof address === 'string') {
      throw new Error('Failed to start test server')
    }
    baseUrl = `http://127.0.0.1:${address.port}`

    mocks.loadConfigState.mockResolvedValue({
      workspaceFolder,
      projectConfig: {},
      userConfig: {}
    })
  })

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      if (server == null) {
        resolve()
        return
      }
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })
    server = undefined
    baseUrl = ''
    await rm(workspaceFolder, { recursive: true, force: true })
    workspaceFolder = ''
    vi.clearAllMocks()
  })

  it('persists returned adapter account artifacts after the manage action succeeds', async () => {
    mocks.loadAdapter.mockResolvedValue({
      manageAccount: vi.fn().mockResolvedValue({
        accountKey: 'work',
        artifacts: [
          { path: 'auth.json', content: '{"token":"demo"}\n' },
          { path: 'meta.json', content: '{"title":"Work"}\n' }
        ],
        message: 'Connected account.'
      }),
      getAccountDetail: vi.fn().mockResolvedValue({
        account: {
          key: 'work',
          title: 'Work',
          status: 'ready'
        }
      })
    })

    const response = await fetch(`${baseUrl}/api/adapters/codex/accounts/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add',
        account: 'work'
      })
    })

    const payload = await response.json() as { account?: { key: string } }
    expect(response.status).toBe(200)
    expect(payload.account?.key).toBe('work')
    await expect(
      readFile(path.join(workspaceFolder, '.ai', '.local', 'adapters', 'codex', 'accounts', 'work', 'auth.json'), 'utf8')
    ).resolves.toBe('{"token":"demo"}\n')
  })

  it('returns adapter account detail through the dedicated detail route', async () => {
    mocks.loadAdapter.mockResolvedValue({
      getAccountDetail: vi.fn().mockResolvedValue({
        account: {
          key: 'work',
          title: 'Work',
          status: 'ready',
          quota: {
            summary: 'Plan: Pro'
          }
        }
      })
    })

    const response = await fetch(`${baseUrl}/api/adapters/codex/accounts/work`)
    const payload = await response.json() as { account?: { key: string; quota?: { summary?: string } } }

    expect(response.status).toBe(200)
    expect(payload.account?.key).toBe('work')
    expect(payload.account?.quota?.summary).toBe('Plan: Pro')
  })
})
