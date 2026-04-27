import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { prepareClaudeExecution } from '../src/claude/prepare'

vi.mock('../src/ccr/paths', () => ({
  CLAUDE_CODE_CLI_PACKAGE: '@anthropic-ai/claude-code',
  CLAUDE_CODE_CLI_VERSION: '0.0.0-test',
  resolveClaudeCliPath: vi.fn(() => '/mock/claude')
}))

vi.mock('@vibe-forge/utils/managed-npm-cli', () => ({
  ensureManagedNpmCli: vi.fn(async ({ bundledPath }: { bundledPath?: string }) => bundledPath ?? '/mock/claude')
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

  it('keeps explicit resume sessions in resume mode even when resume-state cache is missing', async () => {
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
      type: 'resume',
      runtime: 'cli',
      sessionId: 'sess-resume',
      onEvent: vi.fn()
    })

    expect(prepared.executionType).toBe('resume')
    expect(prepared.args).toContain('--resume')
    expect(prepared.args).toContain('sess-resume')
    expect(prepared.args).not.toContain('--session-id')
  })

  it('falls back to create only when resume-state explicitly marks resume as unavailable', async () => {
    const prepared = await prepareClaudeExecution({
      ctxId: 'ctx-1',
      cwd: '/repo',
      env: {},
      cache: {
        set: vi.fn(async (key: string) => ({
          cachePath: `/tmp/${key}.json`
        })) as any,
        get: vi.fn(async (key: string) =>
          key === 'adapter.claude-code.resume-state'
            ? { canResume: false }
            : undefined
        ) as any
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      } as any,
      configs: [{}, {}]
    }, {
      type: 'resume',
      runtime: 'cli',
      sessionId: 'sess-create-fallback',
      onEvent: vi.fn()
    })

    expect(prepared.executionType).toBe('create')
    expect(prepared.args).toContain('--session-id')
    expect(prepared.args).toContain('sess-create-fallback')
    expect(prepared.args).not.toContain('--resume')
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

  it('deep merges settingsContent across layered adapter config entries', async () => {
    const cacheSet = vi.fn(async (key: string, value: unknown) => {
      if (key === 'adapter.claude-code.settings') {
        settingsSnapshot = value as Record<string, any>
      }

      return {
        cachePath: `/tmp/${key}.json`
      }
    })

    await prepareClaudeExecution({
      ctxId: 'ctx-merge',
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
      configs: [{
        adapters: {
          'claude-code': {
            settingsContent: {
              outputStyle: {
                tone: 'concise',
                bullets: true
              }
            }
          }
        }
      }, {
        adapters: {
          'claude-code': {
            settingsContent: {
              outputStyle: {
                bullets: false
              },
              approvals: {
                mode: 'plan'
              }
            }
          }
        }
      }]
    } as any, {
      type: 'create',
      runtime: 'server',
      sessionId: 'sess-merge',
      onEvent: vi.fn()
    })

    expect(settingsSnapshot?.outputStyle).toEqual({
      tone: 'concise',
      bullets: false
    })
    expect(settingsSnapshot?.approvals).toEqual({
      mode: 'plan'
    })
  })
})
