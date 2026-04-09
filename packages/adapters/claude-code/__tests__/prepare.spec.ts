import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { prepareClaudeExecution } from '../src/claude/prepare'

vi.mock('../src/ccr/paths', () => ({
  resolveClaudeCliPath: vi.fn(() => '/mock/claude')
}))

vi.mock('../src/ccr/daemon', () => ({
  ensureClaudeCodeRouterReady: vi.fn()
}))

describe('prepareClaudeExecution', () => {
  let settingsSnapshot: Record<string, any> | undefined

  beforeEach(() => {
    settingsSnapshot = undefined
  })

  it('disables the native AskUserQuestion tool for server runtime sessions', async () => {
    const cacheSet = vi.fn(async (key: string, value: unknown) => {
      if (key === 'adapter.claude-code.settings') {
        settingsSnapshot = value as Record<string, any>
      }

      return {
        cachePath: `/tmp/${key}.json`
      }
    })

    const prepared = await prepareClaudeExecution({
      ctxId: 'ctx-1',
      cwd: '/repo',
      env: {},
      cache: {
        set: cacheSet as any,
        get: vi.fn(async () => undefined) as any
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      } as any,
      configs: [{}, {}]
    }, {
      type: 'create',
      runtime: 'server',
      sessionId: 'sess-1',
      tools: {
        include: ['AskUserQuestion', 'Read']
      },
      onEvent: vi.fn()
    })

    expect(prepared.cliPath).toBe('/mock/claude')
    expect(settingsSnapshot?.permissions.allow).toContain('Read')
    expect(settingsSnapshot?.permissions.allow).not.toContain('AskUserQuestion')
    expect(settingsSnapshot?.permissions.deny).toContain('AskUserQuestion')
  })

  it('passes bypassPermissions through to the Claude CLI in headless mode', async () => {
    const prepared = await prepareClaudeExecution({
      ctxId: 'ctx-1',
      cwd: '/repo',
      env: {},
      cache: {
        set: vi.fn(async (key: string) => ({
          cachePath: `/tmp/${key}.json`
        })) as any,
        get: vi.fn(async () => undefined) as any
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      } as any,
      configs: [{}, {}]
    }, {
      type: 'create',
      runtime: 'server',
      sessionId: 'sess-2',
      permissionMode: 'bypassPermissions',
      onEvent: vi.fn()
    })

    expect(prepared.args).toContain('--dangerously-skip-permissions')
    expect(prepared.args).not.toContain('--permission-mode')
  })

  it('stages managed Claude plugins into the session cache and passes --plugin-dir', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'claude-prepare-'))
    await mkdir(join(cwd, '.ai/plugins/demo/native/.claude-plugin'), { recursive: true })
    await mkdir(join(cwd, '.ai/plugins/demo/vibe-forge'), { recursive: true })
    await writeFile(
      join(cwd, '.ai/plugins/demo/.vf-plugin.json'),
      JSON.stringify(
        {
          version: 1,
          adapter: 'claude',
          name: 'demo',
          scope: 'demo',
          installedAt: new Date().toISOString(),
          source: {
            type: 'path',
            path: './demo'
          },
          nativePluginPath: 'native',
          vibeForgePluginPath: 'vibe-forge'
        },
        null,
        2
      )
    )
    await writeFile(join(cwd, '.ai/plugins/demo/native/.claude-plugin/plugin.json'), JSON.stringify({ name: 'demo' }))

    const prepared = await prepareClaudeExecution({
      ctxId: 'ctx-plugins',
      cwd,
      env: {},
      cache: {
        set: vi.fn(async (key: string) => ({
          cachePath: `/tmp/${key}.json`
        })) as any,
        get: vi.fn(async () => undefined) as any
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      } as any,
      configs: [{}, {}]
    }, {
      type: 'create',
      runtime: 'cli',
      sessionId: 'sess-plugins',
      onEvent: vi.fn()
    })

    const pluginDirIndex = prepared.args.findIndex(arg => arg === '--plugin-dir')
    expect(pluginDirIndex).toBeGreaterThan(-1)
    const stagedPluginDir = prepared.args[pluginDirIndex + 1]
    expect(stagedPluginDir).toContain('.ai/caches/ctx-plugins/sess-plugins/.claude-plugins/')
  })
})
