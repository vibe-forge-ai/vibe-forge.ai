import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import fg from 'fast-glob'
import { afterEach, describe, expect, it } from 'vitest'

import { callHook } from '#~/hooks/call.js'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('hook runtime', () => {
  it('executes hooks locally without requiring the server route', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'vf-hook-'))
    tempDirs.push(workspace)

    await writeFile(
      join(workspace, '.ai.config.json'),
      JSON.stringify({
        plugins: {
          logger: {}
        }
      })
    )

    const result = await callHook(
      'TaskStart',
      {
        cwd: workspace,
        sessionId: 'session-1',
        adapter: 'codex',
        options: { cwd: workspace },
        adapterOptions: { sessionId: 'session-1', runtime: 'cli', type: 'create' }
      },
      {
        ...process.env,
        __VF_PROJECT_AI_CTX_ID__: 'ctx-local-hook',
        __VF_PROJECT_AI_SERVER_HOST__: '127.0.0.1',
        __VF_PROJECT_AI_SERVER_PORT__: '1'
      }
    )

    expect(result).toEqual({ continue: true })

    const logFiles = await fg('.ai/logs/ctx-local-hook/**/*.log.md', {
      cwd: workspace,
      absolute: true
    })
    expect(logFiles).toHaveLength(1)

    const logContent = await readFile(logFiles[0], 'utf-8')
    expect(logContent).toContain('[TaskStart]')
    expect(logContent).toContain('[plugin.logger]')
  })
})
