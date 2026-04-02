import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@vibe-forge/utils', async () => await import('../../../utils/src/index'))

const {
  resolveRequestLogContext,
  writeRequestDebugLog
} = await import('../src/ccr/transformers/log-context')

const createdDirs = new Set<string>()

const createWorkspace = () => {
  const cwd = mkdtempSync(join(tmpdir(), 'vf-claude-log-context-'))
  createdDirs.add(cwd)
  return cwd
}

const writeRequestLogContext = (workspace: string, payload: { ctxId: string, sessionId: string }) => {
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
})
