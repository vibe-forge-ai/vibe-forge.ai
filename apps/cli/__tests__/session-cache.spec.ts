import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'

import { Command } from 'commander'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { registerListCommand } from '#~/commands/list.js'
import {
  formatResumeCommand,
  listCliSessions,
  resolveCliSession,
  resolveCliSessionAdapter,
  writeCliSessionRecord
} from '#~/session-cache.js'

const tempDirs: string[] = []
const originalCwd = process.cwd()

const createTempDir = async () => {
  const cwd = await fs.mkdtemp(path.join(tmpdir(), 'vf-session-cache-'))
  tempDirs.push(cwd)
  return cwd
}

afterEach(async () => {
  vi.restoreAllMocks()
  process.chdir(originalCwd)
  await Promise.all(tempDirs.splice(0).map(dir => fs.rm(dir, { force: true, recursive: true })))
})

describe('session cache utilities', () => {
  it('lists cached sessions and resolves them by session id prefix', async () => {
    const cwd = await createTempDir()

    await writeCliSessionRecord(cwd, 'ctx-alpha', 'session-alpha', {
      resume: {
        version: 1,
        ctxId: 'ctx-alpha',
        sessionId: 'session-alpha',
        cwd,
        description: 'Inspect README',
        createdAt: 1,
        updatedAt: 2,
        resolvedAdapter: 'codex',
        taskOptions: {
          adapter: 'claude-code',
          cwd,
          ctxId: 'ctx-alpha'
        },
        adapterOptions: {
          runtime: 'cli',
          sessionId: 'session-alpha',
          mode: 'direct',
          model: 'gpt-5.4'
        },
        outputFormat: 'text'
      },
      detail: {
        ctxId: 'ctx-alpha',
        sessionId: 'session-alpha',
        status: 'completed',
        startTime: 1,
        endTime: 2,
        description: 'Inspect README',
        adapter: 'codex',
        model: 'gpt-5.4'
      }
    })

    const records = await listCliSessions(cwd)
    expect(records).toHaveLength(1)
    expect(records[0]?.resume?.sessionId).toBe('session-alpha')

    const resolved = await resolveCliSession(cwd, 'session-a')
    expect(resolved.resume?.ctxId).toBe('ctx-alpha')
    expect(resolveCliSessionAdapter(resolved)).toBe('codex')
    expect(formatResumeCommand('session-alpha')).toBe('vf --resume session-alpha')
  })

  it('reports ambiguous prefix matches clearly', async () => {
    const cwd = await createTempDir()

    for (const suffix of ['one', 'two']) {
      await writeCliSessionRecord(cwd, `ctx-${suffix}`, `session-${suffix}`, {
        resume: {
          version: 1,
          ctxId: `ctx-${suffix}`,
          sessionId: `session-${suffix}`,
          cwd,
          createdAt: 1,
          updatedAt: 1,
          taskOptions: {
            cwd,
            ctxId: `ctx-${suffix}`
          },
          adapterOptions: {
            runtime: 'cli',
            sessionId: `session-${suffix}`,
            mode: 'direct'
          },
          outputFormat: 'text'
        }
      })
    }

    await expect(resolveCliSession(cwd, 'session-')).rejects.toThrow('ambiguous')
  })
})

describe('list command', () => {
  it('prints a compact table by default and shows next-step hints', async () => {
    const cwd = await createTempDir()
    const tableSpy = vi.spyOn(console, 'table').mockImplementation(() => {})
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await writeCliSessionRecord(cwd, 'ctx-demo', 'session-demo', {
      resume: {
        version: 1,
        ctxId: 'ctx-demo',
        sessionId: 'session-demo',
        cwd,
        description: 'Review CLI resume flow',
        createdAt: 10,
        updatedAt: 20,
        resolvedAdapter: 'codex',
        taskOptions: {
          adapter: 'codex',
          cwd,
          ctxId: 'ctx-demo'
        },
        adapterOptions: {
          runtime: 'cli',
          sessionId: 'session-demo',
          mode: 'direct',
          model: 'gpt-5.4'
        },
        outputFormat: 'text'
      },
      detail: {
        ctxId: 'ctx-demo',
        sessionId: 'session-demo',
        status: 'running',
        pid: 123,
        startTime: 10,
        description: 'Review CLI resume flow',
        adapter: 'codex',
        model: 'gpt-5.4'
      }
    })

    process.chdir(cwd)
    const program = new Command()
    registerListCommand(program)
    await program.parseAsync(['list'], { from: 'user' })

    expect(tableSpy).toHaveBeenCalledTimes(1)
    expect(tableSpy.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({
        Session: 'session-demo',
        Status: 'running',
        Description: 'Review CLI resume flow'
      })
    ])
    expect(Object.keys(tableSpy.mock.calls[0]?.[0]?.[0] ?? {})).toEqual([
      'Session',
      'Status',
      'Updated',
      'Description'
    ])
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Resume latest: vf --resume session-demo')
    )
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Stop a running session: vf stop session-demo')
    )
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('More columns: vf list --view default')
    )
  })

  it('prints full view rows with helper commands', async () => {
    const cwd = await createTempDir()
    const tableSpy = vi.spyOn(console, 'table').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})

    await writeCliSessionRecord(cwd, 'ctx-demo', 'session-demo', {
      resume: {
        version: 1,
        ctxId: 'ctx-demo',
        sessionId: 'session-demo',
        cwd,
        description: 'Review CLI resume flow',
        createdAt: 10,
        updatedAt: 20,
        resolvedAdapter: 'codex',
        taskOptions: {
          adapter: 'codex',
          cwd,
          ctxId: 'ctx-demo'
        },
        adapterOptions: {
          runtime: 'cli',
          sessionId: 'session-demo',
          mode: 'direct',
          model: 'gpt-5.4'
        },
        outputFormat: 'text'
      },
      detail: {
        ctxId: 'ctx-demo',
        sessionId: 'session-demo',
        status: 'running',
        pid: 123,
        startTime: 10,
        description: 'Review CLI resume flow',
        adapter: 'codex',
        model: 'gpt-5.4'
      }
    })

    process.chdir(cwd)
    const program = new Command()
    registerListCommand(program)
    await program.parseAsync(['list', '--view', 'full'], { from: 'user' })

    expect(tableSpy).toHaveBeenCalledTimes(1)
    expect(tableSpy.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({
        Session: 'session-demo',
        Context: 'ctx-demo',
        Resume: 'vf --resume session-demo',
        Stop: 'vf stop session-demo',
        Kill: 'vf kill session-demo'
      })
    ])
  })

  it('supports filtering to running sessions only', async () => {
    const cwd = await createTempDir()
    const tableSpy = vi.spyOn(console, 'table').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})

    await writeCliSessionRecord(cwd, 'ctx-running', 'session-running', {
      resume: {
        version: 1,
        ctxId: 'ctx-running',
        sessionId: 'session-running',
        cwd,
        createdAt: 10,
        updatedAt: 20,
        resolvedAdapter: 'codex',
        taskOptions: { cwd, ctxId: 'ctx-running' },
        adapterOptions: { runtime: 'cli', sessionId: 'session-running', mode: 'direct' },
        outputFormat: 'text'
      },
      detail: {
        ctxId: 'ctx-running',
        sessionId: 'session-running',
        status: 'running',
        startTime: 10
      }
    })

    await writeCliSessionRecord(cwd, 'ctx-done', 'session-done', {
      resume: {
        version: 1,
        ctxId: 'ctx-done',
        sessionId: 'session-done',
        cwd,
        createdAt: 11,
        updatedAt: 21,
        resolvedAdapter: 'claude-code',
        taskOptions: { cwd, ctxId: 'ctx-done' },
        adapterOptions: { runtime: 'cli', sessionId: 'session-done', mode: 'direct' },
        outputFormat: 'text'
      },
      detail: {
        ctxId: 'ctx-done',
        sessionId: 'session-done',
        status: 'completed',
        startTime: 11
      }
    })

    process.chdir(cwd)
    const program = new Command()
    registerListCommand(program)
    await program.parseAsync(['list', '--running'], { from: 'user' })

    expect(tableSpy).toHaveBeenCalledTimes(1)
    expect(tableSpy.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({
        Session: 'session-running',
        Status: 'running'
      })
    ])
  })

  it('rejects unsupported list status filters', async () => {
    const cwd = await createTempDir()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

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

    process.chdir(cwd)
    const program = new Command()
    registerListCommand(program)

    await expect(program.parseAsync(['list', '--status', 'weird'], { from: 'user' })).rejects.toThrow(
      'process.exit'
    )
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Unsupported status "weird"'))
  })
})
