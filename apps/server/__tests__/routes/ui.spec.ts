import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import http from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'

import Koa from 'koa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { mountRoutes } from '#~/routes/index.js'

describe('ui static routing', () => {
  let distDir = ''
  let server: http.Server | undefined
  let baseUrl = ''

  beforeEach(async () => {
    distDir = await mkdtemp(path.join(tmpdir(), 'vf-ui-route-'))
    await mkdir(path.join(distDir, 'assets'), { recursive: true })
    await writeFile(
      path.join(distDir, 'index.html'),
      [
        '<!doctype html>',
        '<html>',
        '<head>',
        '<link rel="stylesheet" href="/__VF_PROJECT_AI_CLIENT_BASE__/assets/app.css">',
        '</head>',
        '<body>ok</body>',
        '</html>'
      ].join('')
    )
    await writeFile(
      path.join(distDir, 'assets/app.css'),
      'body{background:url(/__VF_PROJECT_AI_CLIENT_BASE__/assets/font.woff2)}'
    )
    await writeFile(path.join(distDir, 'assets/font.woff2'), 'font-data')
    await writeFile(path.join(distDir, 'favicon.svg'), '<svg></svg>')
    await writeFile(path.join(distDir, 'manifest.webmanifest'), '{"name":"Vibe Forge Web"}')
    await writeFile(path.join(distDir, 'sw.js'), 'self.addEventListener("fetch", () => {})')

    const app = new Koa()
    await mountRoutes(
      app,
      {
        __VF_PROJECT_AI_SERVER_HOST__: '127.0.0.1',
        __VF_PROJECT_AI_SERVER_PORT__: 0,
        __VF_PROJECT_AI_SERVER_WS_PATH__: '/ws',
        __VF_PROJECT_AI_CLIENT_BASE__: '/ui',
        __VF_PROJECT_AI_CLIENT_DIST_PATH__: distDir
      } as Parameters<typeof mountRoutes>[1]
    )

    server = http.createServer(app.callback())
    await new Promise<void>((resolve) => {
      server!.listen(0, '127.0.0.1', () => resolve())
    })
    const address = server.address()
    if (address == null || typeof address === 'string') {
      throw new Error('Failed to start test server')
    }
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      if (!server) {
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
    if (distDir !== '') {
      await rm(distDir, { recursive: true, force: true })
      distDir = ''
    }
    baseUrl = ''
  })

  it('serves placeholder asset paths through the mounted ui alias', async () => {
    const indexResponse = await fetch(`${baseUrl}/ui/`)
    const indexHtml = await indexResponse.text()
    expect(indexResponse.status).toBe(200)
    expect(indexHtml).toContain('/ui/assets/app.css')

    const assetResponse = await fetch(`${baseUrl}/__VF_PROJECT_AI_CLIENT_BASE__/assets/font.woff2`)
    const assetBody = await assetResponse.text()
    expect(assetResponse.status).toBe(200)
    expect(assetBody).toBe('font-data')
  })

  it('redirects the client base without a trailing slash to the mounted ui alias', async () => {
    const response = await fetch(`${baseUrl}/ui`, {
      redirect: 'manual'
    })

    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe('/ui/')
  })

  it('serves root static files before falling back to the spa shell', async () => {
    const manifestResponse = await fetch(`${baseUrl}/ui/manifest.webmanifest`)
    const manifestBody = await manifestResponse.text()
    expect(manifestResponse.status).toBe(200)
    expect(manifestBody).toBe('{"name":"Vibe Forge Web"}')

    const workerResponse = await fetch(`${baseUrl}/ui/sw.js`)
    const workerBody = await workerResponse.text()
    expect(workerResponse.status).toBe(200)
    expect(workerResponse.headers.get('cache-control')).toContain('no-cache')
    expect(workerBody).toBe('self.addEventListener("fetch", () => {})')

    const routeResponse = await fetch(`${baseUrl}/ui/session/example`)
    const routeBody = await routeResponse.text()
    expect(routeResponse.status).toBe(200)
    expect(routeBody).toContain('<body>ok</body>')

    const indexResponse = await fetch(`${baseUrl}/ui/index.html`)
    const indexBody = await indexResponse.text()
    expect(indexResponse.status).toBe(200)
    expect(indexBody).toContain('window.__VF_PROJECT_AI_RUNTIME_ENV__=')
  })
})
