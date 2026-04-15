import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { ensureCodexNativeHooksInstalled } from '../src/runtime/native-hooks'

const tempDirs: string[] = []

const createWorkspace = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'codex-hooks-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('ensureCodexNativeHooksInstalled', () => {
  it('writes managed hooks through the shared call-hook bridge', async () => {
    const workspace = await createWorkspace()
    const mockHome = join(workspace, '.ai', '.mock')
    const ctx = {
      cwd: workspace,
      env: {
        HOME: mockHome
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      },
      assets: {
        hookPlugins: [
          {
            id: 'hookPlugin:project:logger'
          }
        ]
      }
    } as any

    const installed = await ensureCodexNativeHooksInstalled(ctx)
    const hooks = JSON.parse(
      await readFile(join(mockHome, '.codex', 'hooks.json'), 'utf8')
    ) as {
      hooks?: Record<string, Array<{ matcher?: string }>>
    }

    expect(installed).toBe(true)
    expect(ctx.env.__VF_PROJECT_AI_CODEX_NATIVE_HOOKS_AVAILABLE__).toBe('1')
    expect(hooks.hooks?.SessionStart).toHaveLength(1)
    expect(hooks.hooks?.PreToolUse?.[0]?.matcher).toBe('^Bash$')
    expect(hooks.hooks?.PostToolUse?.[0]?.matcher).toBe('^Bash$')
    expect(JSON.stringify(hooks)).toContain('call-hook.js')
    expect(JSON.stringify(hooks)).not.toContain('codex-hook.js')
  })

  it('replaces previously managed codex-hook entries instead of duplicating them', async () => {
    const workspace = await createWorkspace()
    const mockHome = join(workspace, '.ai', '.mock')
    await mkdir(join(mockHome, '.codex'), { recursive: true })
    await writeFile(
      join(mockHome, '.codex', 'hooks.json'),
      JSON.stringify(
        {
          hooks: {
            SessionStart: [{
              hooks: [{ type: 'command', command: '/tmp/codex-hook.js' }]
            }],
            PreToolUse: [{
              matcher: '^Bash$',
              hooks: [{ type: 'command', command: '/tmp/codex-hook.js' }]
            }]
          }
        },
        null,
        2
      )
    )

    const ctx = {
      cwd: workspace,
      env: {
        HOME: mockHome
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      },
      assets: {
        hookPlugins: [
          {
            id: 'hookPlugin:project:logger'
          }
        ]
      }
    } as any

    const installed = await ensureCodexNativeHooksInstalled(ctx)
    const hooks = JSON.parse(
      await readFile(join(mockHome, '.codex', 'hooks.json'), 'utf8')
    ) as {
      hooks?: Record<string, Array<{ matcher?: string }>>
    }

    expect(installed).toBe(true)
    expect(hooks.hooks?.SessionStart).toHaveLength(1)
    expect(hooks.hooks?.PreToolUse).toHaveLength(1)
    expect(JSON.stringify(hooks)).toContain('call-hook.js')
    expect(JSON.stringify(hooks)).not.toContain('codex-hook.js')
  })

  it('does not duplicate managed events already configured in project-level .codex/hooks.json', async () => {
    const workspace = await createWorkspace()
    const mockHome = join(workspace, '.ai', '.mock')
    await mkdir(join(workspace, '.codex'), { recursive: true })
    await writeFile(
      join(workspace, '.codex', 'hooks.json'),
      JSON.stringify(
        {
          hooks: {
            SessionStart: [{
              hooks: [{ type: 'command', command: '$PROJECT/node_modules/.bin/vf-call-hook' }]
            }],
            UserPromptSubmit: [{
              hooks: [{ type: 'command', command: '$PROJECT/node_modules/.bin/vf-call-hook' }]
            }]
          }
        },
        null,
        2
      )
    )

    const ctx = {
      cwd: workspace,
      env: {
        HOME: mockHome
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      },
      assets: {
        hookPlugins: [
          {
            id: 'hookPlugin:project:logger'
          }
        ]
      }
    } as any

    const installed = await ensureCodexNativeHooksInstalled(ctx)
    const hooks = JSON.parse(
      await readFile(join(mockHome, '.codex', 'hooks.json'), 'utf8')
    ) as {
      hooks?: Record<string, Array<{ matcher?: string }>>
    }

    expect(installed).toBe(true)
    expect(hooks.hooks?.SessionStart ?? []).toEqual([])
    expect(hooks.hooks?.UserPromptSubmit ?? []).toEqual([])
    expect(hooks.hooks?.PreToolUse).toHaveLength(1)
    expect(hooks.hooks?.PostToolUse).toHaveLength(1)
    expect(hooks.hooks?.Stop).toHaveLength(1)
  })

  it('prefers the workspace mock home when HOME still points to the real home', async () => {
    const workspace = await createWorkspace()
    const mockHome = join(workspace, '.ai', '.mock')
    const realHome = join(workspace, 'real-home')

    const ctx = {
      cwd: workspace,
      env: {
        HOME: realHome,
        __VF_PROJECT_REAL_HOME__: realHome
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      },
      assets: {
        hookPlugins: [
          {
            id: 'hookPlugin:project:logger'
          }
        ]
      }
    } as any

    const installed = await ensureCodexNativeHooksInstalled(ctx)
    const hooks = JSON.parse(
      await readFile(join(mockHome, '.codex', 'hooks.json'), 'utf8')
    ) as {
      hooks?: Record<string, Array<{ matcher?: string }>>
    }

    expect(installed).toBe(true)
    expect(hooks.hooks?.SessionStart).toHaveLength(1)
    await expect(readFile(join(realHome, '.codex', 'hooks.json'), 'utf8')).rejects.toThrow()
  })
})
