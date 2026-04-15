import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import type { AdapterOutputEvent } from '@vibe-forge/types'

import { createCopilotSession } from '#~/runtime/session.js'

import { flushAsyncWork, makeCtx, makeProc, makeTempDir, registerRuntimeTestHooks } from './runtime-test-helpers'

vi.mock('node:child_process', () => ({
  spawn: vi.fn()
}))

const spawnMock = vi.mocked(spawn)

describe('createCopilotSession direct runtime', () => {
  registerRuntimeTestHooks()

  it('starts Copilot TUI mode with an initial interactive prompt', async () => {
    spawnMock.mockImplementation(() => makeProc())

    const events: AdapterOutputEvent[] = []
    const { ctx } = makeCtx()

    await createCopilotSession(ctx, {
      type: 'create',
      runtime: 'terminal',
      mode: 'direct',
      sessionId: 'session-direct',
      description: 'Fix the bug.',
      model: 'gpt-5',
      effort: 'max',
      onEvent: (event: AdapterOutputEvent) => events.push(event)
    } as any)

    await flushAsyncWork()

    expect(spawnMock.mock.calls[0]?.[0]).toBe('/bin/copilot')
    expect(spawnMock.mock.calls[0]?.[1]).toEqual([
      '--resume',
      'session-direct',
      '--no-auto-update',
      '--no-remote',
      '--config-dir',
      `${ctx.cwd}/.ai/.mock/copilot`,
      '--model',
      'gpt-5',
      '--effort',
      'xhigh',
      '--interactive',
      'Fix the bug.'
    ])
    expect(spawnMock.mock.calls[0]?.[2]).toMatchObject({ stdio: 'inherit' })
    expect(events[0]).toMatchObject({ type: 'init', data: { uuid: 'session-direct', model: 'gpt-5' } })
  })

  it('writes managed workspace trust config by default', async () => {
    spawnMock.mockImplementation(() => makeProc())

    const cwd = await makeTempDir()
    const { ctx } = makeCtx({ cwd })

    await createCopilotSession(ctx, {
      type: 'create',
      runtime: 'terminal',
      mode: 'direct',
      sessionId: 'session-direct-trust',
      description: 'Trust this folder.',
      onEvent: () => {}
    } as any)

    await flushAsyncWork()

    expect(JSON.parse(await readFile(join(cwd, '.ai/.mock/copilot/config.json'), 'utf8'))).toMatchObject({
      trusted_folders: [cwd]
    })
  })

  it('skips managed workspace trust bootstrap when disabled', async () => {
    spawnMock.mockImplementation(() => makeProc())

    const cwd = await makeTempDir()
    const { ctx } = makeCtx({
      cwd,
      configs: [{
        adapters: {
          copilot: {
            disableWorkspaceTrust: true
          }
        }
      }, undefined]
    })

    await createCopilotSession(ctx, {
      type: 'create',
      runtime: 'terminal',
      mode: 'direct',
      sessionId: 'session-direct-no-trust',
      description: 'Skip trust bootstrap.',
      onEvent: () => {}
    } as any)

    await flushAsyncWork()

    await expect(readFile(join(cwd, '.ai/.mock/copilot/config.json'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })
})
