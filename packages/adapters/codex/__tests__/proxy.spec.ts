import { Buffer } from 'node:buffer'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { IncomingMessage, Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { CODEX_PROXY_META_HEADER_NAME, encodeCodexProxyMeta, ensureCodexProxyServer } from '#~/runtime/proxy.js'

const upstreamServers: Server[] = []
const tempDirs: string[] = []

const closeServer = async (server: Server) => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

const readRequestBody = async (req: IncomingMessage) => {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

afterEach(async () => {
  await Promise.all(upstreamServers.splice(0).map(closeServer))
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('codex proxy', () => {
  it('reuses a single local proxy instance across repeated starts', async () => {
    const first = await ensureCodexProxyServer()
    const second = await ensureCodexProxyServer()

    expect(first.baseUrl).toBe(second.baseUrl)
  })

  it('forwards upstream provider metadata and injects max_output_tokens', async () => {
    let capturedRequest:
      | {
        method: string | undefined
        url: string | undefined
        headers: Record<string, string | string[] | undefined>
        body: Record<string, unknown>
      }
      | undefined

    const upstream = createServer(async (req, res) => {
      const bodyText = await readRequestBody(req)
      capturedRequest = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: JSON.parse(bodyText) as Record<string, unknown>
      }
      await new Promise(resolve => setTimeout(resolve, 25))
      res.writeHead(200, {
        'Content-Type': 'application/json'
      })
      res.end(JSON.stringify({ ok: true }))
    })
    upstreamServers.push(upstream)

    await new Promise<void>((resolve, reject) => {
      upstream.once('error', reject)
      upstream.listen(0, '127.0.0.1', () => {
        upstream.off('error', reject)
        resolve()
      })
    })

    const upstreamAddress = upstream.address()
    if (upstreamAddress == null || typeof upstreamAddress === 'string') {
      throw new Error('Failed to resolve upstream address')
    }

    const proxy = await ensureCodexProxyServer()
    const response = await fetch(`${proxy.baseUrl}/responses?stream=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-key',
        [CODEX_PROXY_META_HEADER_NAME]: encodeCodexProxyMeta({
          upstreamBaseUrl: `http://127.0.0.1:${upstreamAddress.port}/v1`,
          queryParams: {
            'api-version': '2025-04-01-preview'
          },
          headers: {
            'X-Tenant': 'tenant-1'
          },
          maxOutputTokens: 8192
        })
      },
      body: JSON.stringify({
        model: 'gpt-5.4',
        input: 'Reply with pong.'
      })
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(capturedRequest).toBeDefined()

    const upstreamUrl = new URL(capturedRequest!.url ?? '/', 'http://127.0.0.1')
    expect(capturedRequest).toMatchObject({
      method: 'POST',
      body: {
        model: 'gpt-5.4',
        input: 'Reply with pong.',
        max_output_tokens: 8192
      }
    })
    expect(upstreamUrl.pathname).toBe('/v1/responses')
    expect(upstreamUrl.searchParams.get('stream')).toBe('true')
    expect(upstreamUrl.searchParams.get('api-version')).toBe('2025-04-01-preview')
    expect(capturedRequest?.headers.authorization).toBe('Bearer test-key')
    expect(capturedRequest?.headers['x-tenant']).toBe('tenant-1')
    expect(capturedRequest?.headers['x-vibe-forge-proxy-meta']).toBeUndefined()
  })

  it('replays JSON request bodies across upstream 308 redirects', async () => {
    let capturedBody: string | undefined

    const target = createServer(async (req, res) => {
      capturedBody = await readRequestBody(req)
      res.writeHead(200, {
        'Content-Type': 'application/json'
      })
      res.end(JSON.stringify({ ok: true }))
    })
    upstreamServers.push(target)

    await new Promise<void>((resolve, reject) => {
      target.once('error', reject)
      target.listen(0, '127.0.0.1', () => {
        target.off('error', reject)
        resolve()
      })
    })

    const targetAddress = target.address()
    if (targetAddress == null || typeof targetAddress === 'string') {
      throw new Error('Failed to resolve redirect target address')
    }

    const redirector = createServer((req, res) => {
      res.writeHead(308, {
        location: `http://127.0.0.1:${targetAddress.port}${req.url ?? '/responses'}`
      })
      res.end()
    })
    upstreamServers.push(redirector)

    await new Promise<void>((resolve, reject) => {
      redirector.once('error', reject)
      redirector.listen(0, '127.0.0.1', () => {
        redirector.off('error', reject)
        resolve()
      })
    })

    const redirectAddress = redirector.address()
    if (redirectAddress == null || typeof redirectAddress === 'string') {
      throw new Error('Failed to resolve redirector address')
    }

    const proxy = await ensureCodexProxyServer()
    const response = await fetch(`${proxy.baseUrl}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [CODEX_PROXY_META_HEADER_NAME]: encodeCodexProxyMeta({
          upstreamBaseUrl: `http://127.0.0.1:${redirectAddress.port}`,
          maxOutputTokens: 8192
        })
      },
      body: JSON.stringify({
        model: 'gpt-5.4',
        input: 'Reply with pong.'
      })
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(capturedBody).toBe(JSON.stringify({
      model: 'gpt-5.4',
      input: 'Reply with pong.',
      max_output_tokens: 8192
    }))
  })

  it('writes proxy logs to the adapter-codex scoped log file', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'vf-codex-proxy-log-'))
    tempDirs.push(cwd)

    const upstream = createServer(async (_req, res) => {
      await new Promise(resolve => setTimeout(resolve, 25))
      res.writeHead(500, {
        'Content-Type': 'application/json'
      })
      res.end(JSON.stringify({
        error: {
          message: 'upstream failed'
        }
      }))
    })
    upstreamServers.push(upstream)

    await new Promise<void>((resolve, reject) => {
      upstream.once('error', reject)
      upstream.listen(0, '127.0.0.1', () => {
        upstream.off('error', reject)
        resolve()
      })
    })

    const upstreamAddress = upstream.address()
    if (upstreamAddress == null || typeof upstreamAddress === 'string') {
      throw new Error('Failed to resolve upstream address')
    }

    const proxy = await ensureCodexProxyServer()
    const response = await fetch(`${proxy.baseUrl}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-key',
        [CODEX_PROXY_META_HEADER_NAME]: encodeCodexProxyMeta({
          upstreamBaseUrl: `http://127.0.0.1:${upstreamAddress.port}`,
          maxOutputTokens: 8192,
          queryParams: {
            'api-version': '2025-04-01-preview'
          },
          headers: {
            'X-Tenant': 'tenant-1'
          },
          logContext: {
            cwd,
            ctxId: 'ctx-1',
            sessionId: 'session-1'
          },
          diagnostics: {
            routedServiceKey: 'azure',
            requestedModel: 'azure,gpt-5.4',
            resolvedModel: 'gpt-5.4',
            requestedEffort: 'max',
            effectiveEffort: 'max',
            runtime: 'server',
            sessionType: 'create'
          }
        })
      },
      body: JSON.stringify({
        model: 'gpt-5.4',
        input: 'Reply with pong.'
      })
    })

    expect(response.status).toBe(500)
    await new Promise(resolve => setTimeout(resolve, 25))

    const logPath = join(cwd, '.ai', 'logs', 'ctx-1', 'session-1', 'adapter-codex', 'proxy.log.md')
    const logContent = await readFile(logPath, 'utf8')
    expect(logContent).toContain('[codex proxy] request received')
    expect(logContent).toContain('[codex proxy] forwarding request')
    expect(logContent).toContain('[codex proxy] upstream returned error status')
    expect(logContent).toContain('"requestedModel": "azure,gpt-5.4"')
    expect(logContent).toContain('"effectiveEffort": "max"')
    expect(logContent).toContain('"authorization": "[REDACTED]"')
    expect(logContent).toContain('"api-version": "2025-04-01-preview"')
    expect(logContent).toContain('"max_output_tokens": 8192')
    expect(logContent).toContain('"message": "upstream failed"')
  })
})
