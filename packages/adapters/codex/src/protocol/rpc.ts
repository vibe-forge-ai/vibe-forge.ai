import type { ChildProcess } from 'node:child_process'
import readline from 'node:readline'

import type { Logger } from '@vibe-forge/utils/create-logger'

import type { CodexNotification, CodexRequest, CodexResponse } from '#~/types.js'

export class CodexRpcError extends Error {
  readonly code: number
  readonly data?: unknown

  constructor(code: number, message: string, data?: unknown) {
    super(`[${code}] ${message}`)
    this.name = 'CodexRpcError'
    this.code = code
    this.data = data
  }
}

interface PendingReq {
  resolve: (result: unknown) => void
  reject: (err: Error) => void
}

type NotificationHandler = (method: string, params: Record<string, unknown>) => void

/**
 * Minimal JSON-RPC 2.0 client over a Node.js ChildProcess stdio transport.
 *
 * Codex app-server omits the `"jsonrpc":"2.0"` header on the wire and uses
 * newline-delimited JSON (JSONL) over stdio.
 */
export class CodexRpcClient {
  private idCounter = 0
  private pending = new Map<number, PendingReq>()
  private notificationHandlers: NotificationHandler[] = []
  private rl: readline.Interface

  constructor(
    private readonly proc: ChildProcess,
    private readonly logger: Logger
  ) {
    this.rl = readline.createInterface({ input: proc.stdout! })
    this.rl.on('line', (line) => {
      const trimmed = line.trim()
      if (!trimmed) return
      this.logger.debug('[codex rpc] recv:', { line: trimmed })
      try {
        const msg = JSON.parse(trimmed) as CodexResponse | CodexNotification
        if ('id' in msg && msg.id != null) {
          // It's a response
          const response = msg as CodexResponse
          const pending = this.pending.get(response.id)
          if (!pending) {
            this.logger.warn('[codex rpc] received response for unknown id', { id: response.id })
            return
          }
          this.pending.delete(response.id)
          if (response.error) {
            pending.reject(
              new CodexRpcError(
                response.error.code,
                response.error.message,
                response.error.data
              )
            )
          } else {
            pending.resolve(response.result)
          }
        } else {
          // It's a notification
          const notification = msg as CodexNotification
          const params = (notification.params ?? {}) as Record<string, unknown>
          for (const handler of this.notificationHandlers) {
            try {
              handler(notification.method, params)
            } catch (err) {
              this.logger.error('[codex rpc] notification handler error', { err })
            }
          }
        }
      } catch (err) {
        this.logger.error('[codex rpc] failed to parse line', { line: trimmed, err })
      }
    })
  }

  /**
   * Send a JSON-RPC request and wait for the response.
   */
  request<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    const id = ++this.idCounter
    const msg: CodexRequest = { method, id, ...(params != null ? { params } : {}) }
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject
      })
      const line = `${JSON.stringify(msg)}\n`
      this.logger.debug('[codex rpc] send:', { line: line.trim() })
      this.proc.stdin!.write(line, (err) => {
        if (err) {
          this.pending.delete(id)
          reject(err)
        }
      })
    })
  }

  /**
   * Send a JSON-RPC notification (fire-and-forget, no `id`).
   */
  notify(method: string, params?: Record<string, unknown>): void {
    const msg: CodexNotification = { method, ...(params != null ? { params } : {}) }
    const line = `${JSON.stringify(msg)}\n`
    this.logger.debug('[codex rpc] notify:', { line: line.trim() })
    this.proc.stdin!.write(line)
  }

  /**
   * Respond to a server-initiated request (approvals, token refresh, etc.).
   * Codex sends these with an `id` and expects a matching `{ id, result }`.
   */
  respond(id: number, result: unknown): void {
    const msg = { id, result }
    const line = `${JSON.stringify(msg)}\n`
    this.logger.debug('[codex rpc] respond:', { line: line.trim() })
    this.proc.stdin!.write(line)
  }

  /**
   * Register a handler for all incoming notifications.
   */
  onNotification(handler: NotificationHandler): void {
    this.notificationHandlers.push(handler)
  }

  /**
   * Remove all pending requests and close the readline interface.
   */
  destroy(reason = 'client destroyed'): void {
    this.rl.close()
    const err = new Error(reason)
    for (const pending of this.pending.values()) {
      pending.reject(err)
    }
    this.pending.clear()
  }
}
