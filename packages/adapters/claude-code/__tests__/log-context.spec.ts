import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)

const {
  resolveRequestLogContext
} = require('../src/ccr/transformers/log-context.js')

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
})
