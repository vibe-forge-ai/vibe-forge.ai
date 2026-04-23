import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { startPreviewServer } = require('../preview-server.cjs') as {
  startPreviewServer: (options: {
    base?: string
    distPath: string
    host?: string
    port?: number
    runtimeEnv?: Record<string, string>
  }) => Promise<{
    close: () => Promise<void>
    origin: string
  }>
}

const createDistFixture = () => {
  const root = mkdtempSync(path.join(tmpdir(), 'vf-client-preview-'))
  const distPath = path.join(root, 'dist')
  mkdirSync(path.join(distPath, 'assets'), { recursive: true })
  writeFileSync(
    path.join(distPath, 'index.html'),
    [
      '<!doctype html>',
      '<html>',
      '<head><meta charset="utf-8"><title>Preview</title></head>',
      '<body>',
      '<div id="root"></div>',
      '<script type="module" src="/__VF_PROJECT_AI_CLIENT_BASE__/assets/main.js"></script>',
      '</body>',
      '</html>'
    ].join('')
  )
  writeFileSync(path.join(distPath, 'assets/main.js'), 'console.log("preview")')
  writeFileSync(path.join(distPath, 'sw.js'), 'self.addEventListener("install", () => {})')
  return {
    cleanup: () => rmSync(root, { force: true, recursive: true }),
    distPath
  }
}

describe('startPreviewServer', () => {
  const cleanups: Array<() => void> = []
  const servers: Array<{ close: () => Promise<void> }> = []

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()))
    cleanups.splice(0).forEach((cleanup) => cleanup())
  })

  it('redirects to the configured base and serves the static dist with runtime env injection', async () => {
    const fixture = createDistFixture()
    cleanups.push(fixture.cleanup)

    const preview = await startPreviewServer({
      base: '/ui',
      distPath: fixture.distPath,
      host: '127.0.0.1',
      port: 0,
      runtimeEnv: {
        __VF_PROJECT_AI_CLIENT_MODE__: 'static',
        __VF_PROJECT_AI_SERVER_PORT__: '8787'
      }
    })
    servers.push(preview)

    const redirectResponse = await fetch(`${preview.origin}/`, { redirect: 'manual' })
    expect(redirectResponse.status).toBe(308)
    expect(redirectResponse.headers.get('location')).toBe('/ui/')

    const htmlResponse = await fetch(`${preview.origin}/ui/`)
    expect(htmlResponse.status).toBe(200)
    const html = await htmlResponse.text()
    expect(html).toContain('/ui/assets/main.js')
    expect(html).toContain('window.__VF_PROJECT_AI_RUNTIME_ENV__=')
    expect(html).toContain('"__VF_PROJECT_AI_SERVER_PORT__":"8787"')

    const assetResponse = await fetch(`${preview.origin}/ui/assets/main.js`)
    expect(assetResponse.status).toBe(200)
    expect(assetResponse.headers.get('content-type')).toContain('text/javascript')
    expect(await assetResponse.text()).toBe('console.log("preview")')

    const legacyAssetResponse = await fetch(
      `${preview.origin}/__VF_PROJECT_AI_CLIENT_BASE__/assets/main.js`
    )
    expect(legacyAssetResponse.status).toBe(200)
    expect(await legacyAssetResponse.text()).toBe('console.log("preview")')

    const spaFallbackResponse = await fetch(`${preview.origin}/ui/session/123`)
    expect(spaFallbackResponse.status).toBe(200)
    expect(await spaFallbackResponse.text()).toContain('/ui/assets/main.js')

    const serviceWorkerResponse = await fetch(`${preview.origin}/ui/sw.js`)
    expect(serviceWorkerResponse.headers.get('cache-control')).toBe('no-cache')
  })
})
