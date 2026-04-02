import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { writeCliSessionRecord } from '#~/session-cache.js'

const tempDirs: string[] = []
const cliPath = path.resolve(process.cwd(), 'apps/cli/cli.js')

const createTempDir = async () => {
  const cwd = await fs.mkdtemp(path.join(tmpdir(), 'vf-cli-errors-'))
  tempDirs.push(cwd)
  return cwd
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true })))
})

describe('cli error output', () => {
  it('prints a clean error when resume target does not exist', async () => {
    const cwd = await createTempDir()

    const result = spawnSync(process.execPath, [cliPath, '--resume', 'missing-session'], {
      cwd,
      encoding: 'utf8'
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Session "missing-session" not found.')
    expect(result.stderr).not.toContain('at resolveCliSession')
    expect(result.stderr).not.toContain('Node.js v')
  })

  it('prints a clean error for invalid list status filters', async () => {
    const cwd = await createTempDir()

    await writeCliSessionRecord(cwd, 'ctx-demo', 'session-demo', {
      resume: {
        version: 1,
        ctxId: 'ctx-demo',
        sessionId: 'session-demo',
        cwd,
        createdAt: 1,
        updatedAt: 1,
        taskOptions: { cwd, ctxId: 'ctx-demo' },
        adapterOptions: { runtime: 'cli', sessionId: 'session-demo', mode: 'direct' },
        outputFormat: 'text'
      }
    })

    const result = spawnSync(process.execPath, [cliPath, 'list', '--status', 'weird'], {
      cwd,
      encoding: 'utf8'
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Unsupported status "weird"')
    expect(result.stderr).not.toContain('apps/cli/src/commands/list.ts')
  })
})
