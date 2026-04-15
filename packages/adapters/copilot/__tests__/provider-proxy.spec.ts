import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { IncomingMessage, Server } from 'node:http'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { registerCopilotProviderProxyRoute } from '#~/runtime/provider-proxy.js'

import { makeTempDir, registerRuntimeTestHooks } from './runtime-test-helpers'

const upstreamServers: Server[] = []

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
})

describe('copilot provider proxy', () => {
  registerRuntimeTestHooks()

  it('routes provider requests through the local proxy and records the lifecycle', async () => {
    const cwd = await makeTempDir('vf-copilot-provider-proxy-')
    let capturedRequest:
      | {
        method: string | undefined
        url: string | undefined
        headers: Record<string, string | string[] | undefined>
        body: Record<string, unknown>
      }
      | undefined

    const upstream = createServer(async (req, res) => {
      capturedRequest = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: JSON.parse(await readRequestBody(req)) as Record<string, unknown>
      }
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

    const route = await registerCopilotProviderProxyRoute({
      upstreamBaseUrl: `http://127.0.0.1:${upstreamAddress.port}/v1`,
      queryParams: {
        'api-version': '2026-04-01'
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
        requestedModel: 'local,gpt-5',
        resolvedModel: 'gpt-5',
        runtime: 'server'
      }
    })
    const response = await fetch(`${route.baseUrl}/responses?stream=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer local-key'
      },
      body: JSON.stringify({
        model: 'gpt-5',
        input: 'Reply with pong.'
      })
    })

    expect(response.status).toBe(500)
    expect(capturedRequest).toMatchObject({
      method: 'POST',
      body: {
        model: 'gpt-5',
        input: 'Reply with pong.'
      }
    })
    const upstreamUrl = new URL(capturedRequest!.url ?? '/', 'http://127.0.0.1')
    expect(upstreamUrl.pathname).toBe('/v1/responses')
    expect(upstreamUrl.searchParams.get('stream')).toBe('true')
    expect(upstreamUrl.searchParams.get('api-version')).toBe('2026-04-01')
    expect(capturedRequest?.headers.authorization).toBe('Bearer local-key')
    expect(capturedRequest?.headers['x-tenant']).toBe('tenant-1')

    await new Promise(resolve => setTimeout(resolve, 25))

    const logPath = join(
      cwd,
      '.ai/logs/ctx-1/session-1/adapter-copilot/provider-proxy.log.md'
    )
    const logContent = await readFile(logPath, 'utf8')
    expect(logContent).toContain('[copilot provider proxy] request received')
    expect(logContent).toContain('[copilot provider proxy] forwarding request')
    expect(logContent).toContain('[copilot provider proxy] upstream returned error status')
    expect(logContent).toContain('requestedModel: "local,gpt-5"')
    expect(logContent).toContain('resolvedModel: gpt-5')
    expect(logContent).toContain('authorization: "[REDACTED]"')
    expect(logContent).toContain('message: upstream failed')
  })
})
