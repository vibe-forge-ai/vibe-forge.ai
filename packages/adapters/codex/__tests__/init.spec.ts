import { lstat, mkdir, mkdtemp, readFile, readlink, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveCodexConfigOverrides } from '../src/runtime/config'
import { initCodexAdapter } from '../src/runtime/init'

const tempDirs: string[] = []

const createBarrier = (size: number) => {
  let pending = size
  let release: (() => void) | undefined
  const waitForAll = new Promise<void>((resolve) => {
    release = resolve
  })

  return async () => {
    pending -= 1
    if (pending === 0) {
      release?.()
    }
    await waitForAll
  }
}

const createWorkspace = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'codex-init-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('initCodexAdapter', () => {
  it('symlinks workspace skills into both Codex skill locations while preserving system skills', async () => {
    const workspace = await createWorkspace()
    const mockHome = join(workspace, '.ai', '.mock')
    const realHome = join(workspace, 'real-home')

    await mkdir(join(workspace, '.ai', 'skills', 'research'), { recursive: true })
    await writeFile(join(workspace, '.ai', 'skills', 'research', 'SKILL.md'), '# Research\n')
    await mkdir(join(realHome, '.codex'), { recursive: true })
    await mkdir(join(mockHome, '.codex', 'skills', '.system'), { recursive: true })
    await writeFile(join(mockHome, '.codex', 'skills', '.system', '.codex-system-skills.marker'), '')

    await initCodexAdapter({
      cwd: workspace,
      env: {
        HOME: mockHome,
        __VF_PROJECT_REAL_HOME__: realHome
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      },
      assets: {
        hookPlugins: []
      }
    } as any)

    const targetPath = join(mockHome, '.agents', 'skills')
    expect((await lstat(targetPath)).isSymbolicLink()).toBe(true)
    expect(resolve(dirname(targetPath), await readlink(targetPath))).toBe(resolve(workspace, '.ai', 'skills'))

    const nativeSkillPath = join(mockHome, '.codex', 'skills', 'research')
    expect((await lstat(nativeSkillPath)).isSymbolicLink()).toBe(true)
    expect(resolve(dirname(nativeSkillPath), await readlink(nativeSkillPath))).toBe(
      resolve(workspace, '.ai', 'skills', 'research')
    )
    expect((await lstat(join(mockHome, '.codex', 'skills', '.system'))).isDirectory()).toBe(true)
    expect(
      JSON.parse(
        await readFile(join(mockHome, '.codex', 'skills', '.vibe-forge-managed-skills.json'), 'utf8')
      )
    ).toEqual({
      skills: ['research']
    })
  })

  it('removes stale managed Codex skill links before syncing the current workspace skills', async () => {
    const workspace = await createWorkspace()
    const mockHome = join(workspace, '.ai', '.mock')
    const realHome = join(workspace, 'real-home')

    await mkdir(join(workspace, '.ai', 'skills', 'report'), { recursive: true })
    await writeFile(join(workspace, '.ai', 'skills', 'report', 'SKILL.md'), '# Report\n')
    await mkdir(join(realHome, '.codex'), { recursive: true })
    await mkdir(join(mockHome, '.codex', 'skills', '.system'), { recursive: true })
    await mkdir(join(mockHome, '.codex', 'skills', 'stale'), { recursive: true })
    await writeFile(
      join(mockHome, '.codex', 'skills', '.vibe-forge-managed-skills.json'),
      JSON.stringify({ skills: ['stale'] }, null, 2)
    )

    await initCodexAdapter({
      cwd: workspace,
      env: {
        HOME: mockHome,
        __VF_PROJECT_REAL_HOME__: realHome
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      },
      assets: {
        hookPlugins: []
      }
    } as any)

    await expect(lstat(join(mockHome, '.codex', 'skills', 'stale'))).rejects.toThrow()
    expect((await lstat(join(mockHome, '.codex', 'skills', '.system'))).isDirectory()).toBe(true)
    expect((await lstat(join(mockHome, '.codex', 'skills', 'report'))).isSymbolicLink()).toBe(true)
  })

  it('writes a managed config.toml that trusts the workspace and disables update checks by default', async () => {
    const workspace = await createWorkspace()
    const mockHome = join(workspace, '.ai', '.mock')
    const realHome = join(workspace, 'real-home')

    await mkdir(join(realHome, '.codex'), { recursive: true })

    await initCodexAdapter({
      cwd: workspace,
      env: {
        HOME: mockHome,
        __VF_PROJECT_REAL_HOME__: realHome
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      },
      assets: {
        hookPlugins: []
      }
    } as any)

    const configContent = await readFile(join(mockHome, '.codex', 'config.toml'), 'utf8')
    expect(configContent).toContain('check_for_update_on_startup = false')
    expect(configContent).toContain('# BEGIN VIBE FORGE MANAGED CODEX ROOT CONFIG')
    expect(configContent).toContain(`[projects.${JSON.stringify(resolve(workspace))}]`)
    expect(configContent).toContain('trust_level = "trusted"')
    expect(configContent).toContain('# BEGIN VIBE FORGE MANAGED CODEX PROJECT CONFIG')
  })

  it('preserves unmanaged config content and replaces the managed block with user overrides', async () => {
    const workspace = await createWorkspace()
    const mockHome = join(workspace, '.ai', '.mock')
    const realHome = join(workspace, 'real-home')
    const configPath = join(mockHome, '.codex', 'config.toml')

    await mkdir(join(realHome, '.codex'), { recursive: true })
    await mkdir(dirname(configPath), { recursive: true })
    await writeFile(
      configPath,
      [
        'model = "gpt-5.4"',
        '',
        '# BEGIN VIBE FORGE MANAGED CODEX CONFIG',
        'check_for_update_on_startup = false',
        '[projects."/tmp/old-workspace"]',
        'trust_level = "trusted"',
        '# END VIBE FORGE MANAGED CODEX CONFIG',
        ''
      ].join('\n')
    )

    const ctx = {
      cwd: workspace,
      env: {
        HOME: mockHome,
        __VF_PROJECT_REAL_HOME__: realHome
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      },
      configs: [{
        adapters: {
          codex: {
            configOverrides: {
              check_for_update_on_startup: true
            }
          }
        }
      }, undefined],
      assets: {
        hookPlugins: []
      }
    } as any

    await initCodexAdapter(ctx)
    await initCodexAdapter(ctx)

    const configContent = await readFile(configPath, 'utf8')
    expect(configContent).toContain('model = "gpt-5.4"')
    expect(configContent).toContain('check_for_update_on_startup = true')
    expect(configContent.match(/BEGIN VIBE FORGE MANAGED CODEX ROOT CONFIG/g)).toHaveLength(1)
    expect(configContent.match(/BEGIN VIBE FORGE MANAGED CODEX PROJECT CONFIG/g)).toHaveLength(1)
    expect(configContent).toContain(`[projects.${JSON.stringify(resolve(workspace))}]`)
    expect(configContent).not.toContain('/tmp/old-workspace')
  })

  it('keeps concurrent skill sync idempotent when multiple vf processes initialize the same mock home', async () => {
    const workspace = await createWorkspace()
    const mockHome = join(workspace, '.ai', '.mock')
    const realHome = join(workspace, 'real-home')
    const barrier = createBarrier(2)

    await mkdir(join(workspace, '.ai', 'skills', 'research'), { recursive: true })
    await writeFile(join(workspace, '.ai', 'skills', 'research', 'SKILL.md'), '# Research\n')
    await mkdir(join(realHome, '.codex'), { recursive: true })

    vi.resetModules()
    vi.doMock('node:fs/promises', async (importOriginal) => {
      const actual = await importOriginal<typeof import('node:fs/promises')>()
      return {
        ...actual,
        symlink: vi.fn(async (...args: Parameters<typeof actual.symlink>) => {
          const [, targetPath] = args
          if (String(targetPath).endsWith(join('.agents', 'skills'))) {
            await barrier()
          }
          return actual.symlink(...args)
        })
      }
    })

    try {
      const { initCodexAdapter: initCodexAdapterWithMockedFs } = await import('../src/runtime/init')
      const ctx = {
        cwd: workspace,
        env: {
          HOME: mockHome,
          __VF_PROJECT_REAL_HOME__: realHome
        },
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn()
        },
        assets: {
          hookPlugins: []
        }
      } as any

      await expect(
        Promise.all([initCodexAdapterWithMockedFs(ctx), initCodexAdapterWithMockedFs(ctx)])
      ).resolves.toHaveLength(2)
      const targetPath = join(mockHome, '.agents', 'skills')
      expect((await lstat(targetPath)).isSymbolicLink()).toBe(true)
      expect(resolve(dirname(targetPath), await readlink(targetPath))).toBe(resolve(workspace, '.ai', 'skills'))
    } finally {
      vi.doUnmock('node:fs/promises')
      vi.resetModules()
    }
  })

  it('deep merges nested codex configOverrides across layered config files', async () => {
    const configOverrides = resolveCodexConfigOverrides({
      configs: [{
        adapters: {
          codex: {
            configOverrides: {
              model: 'gpt-5.4',
              approval_policy: 'unlessTrusted'
            }
          }
        }
      }, {
        adapters: {
          codex: {
            configOverrides: {
              check_for_update_on_startup: true
            }
          }
        }
      }]
    } as any)

    expect(configOverrides).toMatchObject({
      model: 'gpt-5.4',
      approval_policy: 'unlessTrusted',
      check_for_update_on_startup: true
    })
  })
})
