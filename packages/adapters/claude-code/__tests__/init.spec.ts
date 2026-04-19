import { lstat, mkdir, mkdtemp, readFile, readlink, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { initClaudeCodeAdapter } from '../src/claude/init'

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
  const dir = await mkdtemp(join(tmpdir(), 'claude-init-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('initClaudeCodeAdapter', () => {
  it('symlinks workspace skills and macOS keychains into the isolated Claude home', async () => {
    const workspace = await createWorkspace()
    const realHome = await createWorkspace()
    const mockHome = join(workspace, '.ai', '.mock')

    await mkdir(join(workspace, '.ai', 'skills', 'research'), { recursive: true })
    await writeFile(join(workspace, '.ai', 'skills', 'research', 'SKILL.md'), '# Research\n')
    await mkdir(join(realHome, 'Library', 'Keychains'), { recursive: true })
    await writeFile(join(realHome, 'Library', 'Keychains', 'login.keychain-db'), '')

    await initClaudeCodeAdapter({
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

    const targetPath = join(mockHome, '.claude', 'skills')
    expect((await lstat(targetPath)).isSymbolicLink()).toBe(true)
    expect(resolve(dirname(targetPath), await readlink(targetPath))).toBe(resolve(workspace, '.ai', 'skills'))

    const keychainsPath = join(mockHome, 'Library', 'Keychains')
    expect((await lstat(keychainsPath)).isSymbolicLink()).toBe(true)
    expect(resolve(dirname(keychainsPath), await readlink(keychainsPath))).toBe(
      resolve(realHome, 'Library', 'Keychains')
    )
  })

  it('removes stale keychains symlinks when the real home is unavailable', async () => {
    const workspace = await createWorkspace()
    const realHome = await createWorkspace()
    const mockHome = join(workspace, '.ai', '.mock')
    const keychainsPath = join(mockHome, 'Library', 'Keychains')

    await mkdir(join(realHome, 'Library', 'Keychains'), { recursive: true })
    await writeFile(join(realHome, 'Library', 'Keychains', 'login.keychain-db'), '')

    await initClaudeCodeAdapter({
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

    expect((await lstat(keychainsPath)).isSymbolicLink()).toBe(true)

    await initClaudeCodeAdapter({
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
        hookPlugins: []
      }
    } as any)

    await expect(lstat(keychainsPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('syncs plugin-provided skills from resolved workspace assets into the isolated Claude home', async () => {
    const workspace = await createWorkspace()
    const mockHome = join(workspace, '.ai', '.mock')
    const pluginSkillDir = join(workspace, 'vendor', 'vf-cli-skills', 'skills', 'vf-cli-quickstart')

    await mkdir(pluginSkillDir, { recursive: true })
    await writeFile(join(pluginSkillDir, 'SKILL.md'), '# vf-cli-quickstart\n')

    await initClaudeCodeAdapter({
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
        hookPlugins: [],
        skills: [
          {
            id: 'skill:plugin:0:vf-cli-quickstart',
            kind: 'skill',
            name: 'vf-cli-quickstart',
            displayName: 'vf-cli-quickstart',
            origin: 'plugin',
            sourcePath: join(pluginSkillDir, 'SKILL.md'),
            payload: {
              definition: {
                path: join(pluginSkillDir, 'SKILL.md'),
                body: '# vf-cli-quickstart\n',
                attributes: {}
              }
            }
          }
        ]
      }
    } as any)

    const targetPath = join(mockHome, '.claude', 'skills', 'vf-cli-quickstart')
    expect((await lstat(targetPath)).isSymbolicLink()).toBe(true)
    expect(resolve(dirname(targetPath), await readlink(targetPath))).toBe(resolve(pluginSkillDir))
  })

  it('writes managed project trust state into the isolated Claude app-state file', async () => {
    const workspace = await createWorkspace()
    const mockHome = join(workspace, '.ai', '.mock')

    await initClaudeCodeAdapter({
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
        hookPlugins: []
      }
    } as any)

    const appState = JSON.parse(await readFile(join(mockHome, '.claude.json'), 'utf8')) as {
      projects?: Record<string, Record<string, unknown>>
    }

    expect(appState.projects?.[resolve(workspace)]).toMatchObject({
      hasTrustDialogAccepted: true,
      projectOnboardingSeenCount: 1,
      hasCompletedProjectOnboarding: true
    })
  })

  it('keeps concurrent mock-home skill sync idempotent when multiple vf processes initialize Claude together', async () => {
    const workspace = await createWorkspace()
    const mockHome = join(workspace, '.ai', '.mock')
    const barrier = createBarrier(2)

    await mkdir(join(workspace, '.ai', 'skills', 'research'), { recursive: true })
    await writeFile(join(workspace, '.ai', 'skills', 'research', 'SKILL.md'), '# Research\n')

    vi.resetModules()
    vi.doMock('node:fs/promises', async (importOriginal) => {
      const actual = await importOriginal<typeof import('node:fs/promises')>()
      return {
        ...actual,
        symlink: vi.fn(async (...args: Parameters<typeof actual.symlink>) => {
          const [, targetPath] = args
          if (String(targetPath).endsWith(join('.claude', 'skills'))) {
            await barrier()
          }
          return actual.symlink(...args)
        })
      }
    })

    try {
      const { initClaudeCodeAdapter: initClaudeCodeAdapterWithMockedFs } = await import('../src/claude/init')
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
          hookPlugins: []
        }
      } as any

      await expect(
        Promise.all([initClaudeCodeAdapterWithMockedFs(ctx), initClaudeCodeAdapterWithMockedFs(ctx)])
      ).resolves.toHaveLength(2)
      const targetPath = join(mockHome, '.claude', 'skills')
      expect((await lstat(targetPath)).isSymbolicLink()).toBe(true)
      expect(resolve(dirname(targetPath), await readlink(targetPath))).toBe(resolve(workspace, '.ai', 'skills'))
    } finally {
      vi.doUnmock('node:fs/promises')
      vi.resetModules()
    }
  })

  it('preserves existing Claude app state while seeding trust from the real home config', async () => {
    const workspace = await createWorkspace()
    const realHome = await createWorkspace()
    const mockHome = join(workspace, '.ai', '.mock')

    await writeFile(
      join(realHome, '.claude.json'),
      JSON.stringify(
        {
          autoUpdates: false,
          projects: {
            '/tmp/existing-project': {
              hasTrustDialogAccepted: true,
              projectOnboardingSeenCount: 2
            }
          }
        },
        null,
        2
      )
    )

    await initClaudeCodeAdapter({
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

    const appState = JSON.parse(await readFile(join(mockHome, '.claude.json'), 'utf8')) as {
      autoUpdates?: boolean
      projects?: Record<string, Record<string, unknown>>
    }

    expect(appState.autoUpdates).toBe(false)
    expect(appState.projects?.['/tmp/existing-project']).toMatchObject({
      hasTrustDialogAccepted: true,
      projectOnboardingSeenCount: 2
    })
    expect(appState.projects?.[resolve(workspace)]).toMatchObject({
      hasTrustDialogAccepted: true,
      projectOnboardingSeenCount: 1,
      hasCompletedProjectOnboarding: true
    })
  })

  it('merges existing mock-home Claude state with real-home state instead of overwriting it', async () => {
    const workspace = await createWorkspace()
    const realHome = await createWorkspace()
    const mockHome = join(workspace, '.ai', '.mock')

    await writeFile(
      join(realHome, '.claude.json'),
      JSON.stringify(
        {
          autoUpdates: false,
          preferredModel: 'opus',
          projects: {
            '/tmp/from-real': {
              hasTrustDialogAccepted: true,
              projectOnboardingSeenCount: 2
            },
            [resolve(workspace)]: {
              projectOnboardingSeenCount: 2,
              workspaceTheme: 'real-theme'
            }
          }
        },
        null,
        2
      )
    )
    await mkdir(mockHome, { recursive: true })
    await writeFile(
      join(mockHome, '.claude.json'),
      JSON.stringify(
        {
          preferredModel: 'sonnet',
          autoUpdates: true,
          projects: {
            '/tmp/from-mock': {
              notes: 'keep-me'
            },
            [resolve(workspace)]: {
              customFlag: 'preserve-me',
              projectOnboardingSeenCount: 4
            }
          }
        },
        null,
        2
      )
    )

    await initClaudeCodeAdapter({
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

    const appState = JSON.parse(await readFile(join(mockHome, '.claude.json'), 'utf8')) as {
      autoUpdates?: boolean
      preferredModel?: string
      projects?: Record<string, Record<string, unknown>>
    }

    expect(appState.autoUpdates).toBe(false)
    expect(appState.preferredModel).toBe('opus')
    expect(appState.projects?.['/tmp/from-real']).toMatchObject({
      hasTrustDialogAccepted: true,
      projectOnboardingSeenCount: 2
    })
    expect(appState.projects?.['/tmp/from-mock']).toMatchObject({
      notes: 'keep-me'
    })
    expect(appState.projects?.[resolve(workspace)]).toMatchObject({
      customFlag: 'preserve-me',
      workspaceTheme: 'real-theme',
      hasTrustDialogAccepted: true,
      projectOnboardingSeenCount: 2,
      hasCompletedProjectOnboarding: true
    })
  })
})
