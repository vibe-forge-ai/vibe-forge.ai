import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@vibe-forge/utils', async () => await import('../../../utils/src/index'))

const {
  resolveRequestLogContext,
  writeRequestDebugLog,
  writeResponseDebugLog
} = await import('../src/ccr/transformers/log-context')

const createdDirs = new Set<string>()

const createWorkspace = () => {
  const cwd = mkdtempSync(join(tmpdir(), 'vf-claude-log-context-'))
  createdDirs.add(cwd)
  return cwd
}

const writeRequestLogContext = (workspace: string, payload: { ctxId: string; sessionId: string }) => {
  const filePath = join(
    workspace,
    '.ai',
    '.mock',
    '.claude-code-router',
    'request-log-context',
    `${payload.sessionId}.json`
  )
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(payload), 'utf8')
}

describe('ccr request log context', () => {
  afterEach(() => {
    createdDirs.forEach((cwd) => {
      rmSync(cwd, { force: true, recursive: true })
    })
    createdDirs.clear()
    delete process.env.__VF_PROJECT_WORKSPACE_FOLDER__
  })

  it('resolves ctx/session ids from the claude session header and stored mapping', () => {
    const workspace = createWorkspace()
    process.env.__VF_PROJECT_WORKSPACE_FOLDER__ = workspace
    writeRequestLogContext(workspace, {
      ctxId: 'ctx-from-store',
      sessionId: 'session-from-header'
    })

    const parsed = resolveRequestLogContext({
      req: {
        headers: {
          'x-claude-code-session-id': 'session-from-header'
        }
      }
    })

    expect(parsed).toEqual({
      ctxId: 'ctx-from-store',
      sessionId: 'session-from-header'
    })
  })

  it('falls back to request session id when stored mapping is absent', () => {
    const context = {
      req: {
        sessionId: 'session-from-request'
      }
    }

    const parsed = resolveRequestLogContext(context)

    expect(parsed).toEqual({
      ctxId: 'session-from-request',
      sessionId: 'session-from-request'
    })
  })

  it('formats CCR debug logs with the shared YAML logger renderer', () => {
    const workspace = createWorkspace()
    process.env.__VF_PROJECT_WORKSPACE_FOLDER__ = workspace
    writeRequestLogContext(workspace, {
      ctxId: 'ctx-yaml',
      sessionId: 'session-yaml'
    })
    ;(writeRequestDebugLog as (...args: unknown[]) => void)(
      'shared-logger.log.md',
      'request payload',
      {
        a: {
          b: '1233\n456'
        }
      },
      {
        req: {
          headers: {
            'x-claude-code-session-id': 'session-yaml'
          }
        }
      },
      undefined
    )

    const content = readFileSync(
      join(
        workspace,
        '.ai',
        'logs',
        'ctx-yaml',
        'session-yaml',
        'adapter-claude-code',
        'shared-logger.log.md'
      ),
      'utf8'
    )

    expect(content).toContain('__D__ request payload')
    expect(content).toContain('```yaml')
    expect(content).toContain('a:')
    expect(content).toContain('  b: >-')
    expect(content).toContain('    1233')
    expect(content).toContain('    456')
    expect(content).not.toContain('```json')
  })

  it('logs streamed responses after the full body has been assembled', async () => {
    const workspace = createWorkspace()
    process.env.__VF_PROJECT_WORKSPACE_FOLDER__ = workspace
    writeRequestLogContext(workspace, {
      ctxId: 'ctx-stream',
      sessionId: 'session-stream'
    })

    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(
            'data: {"object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant","content":"foo"},"finish_reason":null}]}\n\n'
          ))
          controller.enqueue(new TextEncoder().encode(
            'data: {"object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"bar","thinking":{"content":"baz"}},"finish_reason":"stop"}]}\n\n'
          ))
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
          controller.close()
        }
      }),
      {
        headers: {
          'Content-Type': 'text/event-stream'
        },
        status: 200,
        statusText: 'OK'
      }
    )

    await writeResponseDebugLog(
      'stream-response.log.md',
      'streamed response',
      response,
      {
        req: {
          headers: {
            'x-claude-code-session-id': 'session-stream'
          }
        }
      },
      undefined
    )

    const content = readFileSync(
      join(
        workspace,
        '.ai',
        'logs',
        'ctx-stream',
        'session-stream',
        'adapter-claude-code',
        'stream-response.log.md'
      ),
      'utf8'
    )

    expect(content).toContain('__D__ streamed response')
    expect(content).toContain('status: 200')
    expect(content).toContain('content-type: text/event-stream')
    expect(content).toContain('body:')
    expect(content).toContain('type: event-stream')
    expect(content).toContain('eventCount: 3')
    expect(content).toContain('done: true')
    expect(content).toContain('assembled:')
    expect(content).toContain('type: chat.completion.chunk')
    expect(content).toContain('role: assistant')
    expect(content).toContain('content: foobar')
    expect(content).toContain('content: baz')
    expect(content).toContain('finishReason: stop')
    expect(content).not.toContain('data: {"object":"chat.completion.chunk"')
  })
})
