import { PassThrough } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'

import { CodexRpcClient } from '#~/protocol/rpc.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}

/**
 * Creates a fake ChildProcess whose stdin/stdout are PassThrough streams.
 * Lines written to `feedLine(text)` appear as stdin data to the client.
 */
function makeProc() {
  const stdin = new PassThrough()
  const stdout = new PassThrough()
  const proc = {
    stdin,
    stdout,
    on: (_event: string, _cb: (...args: any[]) => void) => proc
  } as any

  /** Simulate the server writing a raw JSON line to our stdout. */
  const feedLine = (obj: unknown) => {
    stdout.push(`${JSON.stringify(obj)}\n`)
  }

  /** Collect all data written by the client to stdin as parsed JSON objects. */
  const receivedLines: unknown[] = []
  stdin.on('data', (chunk: unknown) => {
    const text = String(chunk)
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (trimmed) {
        try {
          receivedLines.push(JSON.parse(trimmed))
        } catch {
          // not JSON – ignore
        }
      }
    }
  })

  return { proc, feedLine, receivedLines }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('codex rpc client', () => {
  describe('request()', () => {
    it('writes a JSON-RPC request with an auto-incremented id', async () => {
      const { proc, feedLine, receivedLines } = makeProc()
      const rpc = new CodexRpcClient(proc, makeMockLogger() as any)

      const promise = rpc.request('initialize', { clientInfo: { name: 'test', title: 'Test', version: '1.0' } })
      // Simulate the server responding before we await
      await Promise.resolve() // flush microtasks so the write happens
      feedLine({ id: 1, result: { userAgent: 'codex/1.0' } })

      const result = await promise
      expect(result).toEqual({ userAgent: 'codex/1.0' })

      expect(receivedLines).toHaveLength(1)
      const sent = receivedLines[0] as any
      expect(sent.id).toBe(1)
      expect(sent.method).toBe('initialize')
      expect(sent.params.clientInfo.name).toBe('test')
    })

    it('auto-increments ids for successive requests', async () => {
      const { proc, feedLine, receivedLines } = makeProc()
      const rpc = new CodexRpcClient(proc, makeMockLogger() as any)

      const p1 = rpc.request('thread/start', { cwd: '/tmp' })
      const p2 = rpc.request('thread/list', {})

      feedLine({ id: 1, result: { thread: { id: 'thr_a' } } })
      feedLine({ id: 2, result: { data: [] } })

      await Promise.all([p1, p2])

      expect((receivedLines[0] as any).id).toBe(1)
      expect((receivedLines[1] as any).id).toBe(2)
    })

    it('rejects when the server returns an error', async () => {
      const { proc, feedLine } = makeProc()
      const rpc = new CodexRpcClient(proc, makeMockLogger() as any)

      const promise = rpc.request('thread/start', {})
      feedLine({ id: 1, error: { code: -32600, message: 'Not initialized' } })

      await expect(promise).rejects.toThrow('Not initialized')
    })

    it('preserves error data for upstream diagnostics', async () => {
      const { proc, feedLine } = makeProc()
      const rpc = new CodexRpcClient(proc, makeMockLogger() as any)

      const promise = rpc.request('turn/start', {})
      feedLine({
        id: 1,
        error: {
          code: 400,
          message: 'Incomplete response returned',
          data: {
            status: 'incomplete',
            incomplete_details: { reason: 'max_output_tokens' }
          }
        }
      })

      await expect(promise).rejects.toMatchObject({
        name: 'CodexRpcError',
        code: 400,
        data: {
          status: 'incomplete',
          incomplete_details: { reason: 'max_output_tokens' }
        }
      })
    })

    it('rejects all pending requests when destroy() is called', async () => {
      const { proc } = makeProc()
      const rpc = new CodexRpcClient(proc, makeMockLogger() as any)

      const promise = rpc.request('turn/start', {})
      rpc.destroy('test teardown')

      await expect(promise).rejects.toThrow('test teardown')
    })
  })

  describe('notify()', () => {
    it('writes a JSON-RPC message without an id field', async () => {
      const { proc, receivedLines } = makeProc()
      const rpc = new CodexRpcClient(proc, makeMockLogger() as any)

      rpc.notify('initialized', {})

      await new Promise(r => setImmediate(r))

      expect(receivedLines).toHaveLength(1)
      const sent = receivedLines[0] as any
      expect(sent.method).toBe('initialized')
      expect(sent.id).toBeUndefined()
    })
  })

  describe('respond()', () => {
    it('writes a JSON-RPC response with the given id and result', async () => {
      const { proc, receivedLines } = makeProc()
      const rpc = new CodexRpcClient(proc, makeMockLogger() as any)

      rpc.respond(42, 'accept')

      await new Promise(r => setImmediate(r))

      expect(receivedLines).toHaveLength(1)
      const sent = receivedLines[0] as any
      expect(sent.id).toBe(42)
      expect(sent.result).toBe('accept')
      expect(sent.method).toBeUndefined()
    })
  })

  describe('onNotification()', () => {
    it('dispatches incoming server notifications to registered handlers', async () => {
      const { proc, feedLine } = makeProc()
      const rpc = new CodexRpcClient(proc, makeMockLogger() as any)

      const received: Array<[string, unknown]> = []
      rpc.onNotification((method, params) => {
        received.push([method, params])
      })

      feedLine({ method: 'turn/started', params: { turn: { id: 'turn_1' } } })
      feedLine({ method: 'item/agentMessage/delta', params: { itemId: 'item_1', delta: 'Hello' } })

      // Wait for readline to process
      await new Promise(r => setTimeout(r, 20))

      expect(received).toHaveLength(2)
      expect(received[0][0]).toBe('turn/started')
      expect((received[0][1] as any).turn.id).toBe('turn_1')
      expect(received[1][0]).toBe('item/agentMessage/delta')
      expect((received[1][1] as any).delta).toBe('Hello')
    })

    it('dispatches to multiple handlers independently', async () => {
      const { proc, feedLine } = makeProc()
      const rpc = new CodexRpcClient(proc, makeMockLogger() as any)

      const handler1 = vi.fn()
      const handler2 = vi.fn()
      rpc.onNotification(handler1)
      rpc.onNotification(handler2)

      feedLine({ method: 'turn/completed', params: { turn: { id: 'turn_1', status: 'completed', items: [] } } })

      await new Promise(r => setTimeout(r, 20))

      expect(handler1).toHaveBeenCalledOnce()
      expect(handler2).toHaveBeenCalledOnce()
    })

    it('does not dispatch to notification handler for responses', async () => {
      const { proc, feedLine } = makeProc()
      const rpc = new CodexRpcClient(proc, makeMockLogger() as any)

      const handler = vi.fn()
      rpc.onNotification(handler)

      const promise = rpc.request('model/list', {})
      feedLine({ id: 1, result: { data: [] } })
      await promise

      expect(handler).not.toHaveBeenCalled()
    })
  })
})
