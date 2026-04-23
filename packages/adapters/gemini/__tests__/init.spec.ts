import { lstat, mkdir, mkdtemp, readlink, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { initGeminiAdapter } from '../src/runtime/init'

const tempDirs: string[] = []

const createWorkspace = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gemini-init-'))
  tempDirs.push(dir)
  return dir
}

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

afterEach(async () => {
  vi.doUnmock('node:fs/promises')
  vi.resetModules()
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('initGeminiAdapter', () => {
  it('symlinks workspace skills into the shared Gemini mock home', async () => {
    const workspace = await createWorkspace()
    const mockHome = join(workspace, '.ai', '.mock')

    await mkdir(join(workspace, '.ai', 'skills', 'research'), { recursive: true })
    await writeFile(join(workspace, '.ai', 'skills', 'research', 'SKILL.md'), '# Research\n')

    await initGeminiAdapter({
      cwd: workspace,
      env: {
        HOME: mockHome,
        __VF_PROJECT_AI_ADAPTER_GEMINI_CLI_PATH__: '/bin/gemini'
      },
      configs: [undefined, undefined],
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
  })

  it('symlinks resolved asset skills into the shared Gemini mock home', async () => {
    const workspace = await createWorkspace()
    const mockHome = join(workspace, '.ai', '.mock')
    const appSkillDir = join(workspace, '.ai', 'skills', 'app-builder')
    const dependencySkillDir = join(workspace, '.ai', 'caches', 'skill-dependencies', 'skills.sh', 'frontend-design')

    await mkdir(appSkillDir, { recursive: true })
    await mkdir(dependencySkillDir, { recursive: true })
    await writeFile(join(appSkillDir, 'SKILL.md'), '# App Builder\n')
    await writeFile(join(dependencySkillDir, 'SKILL.md'), '# Frontend Design\n')

    await initGeminiAdapter({
      cwd: workspace,
      env: {
        HOME: mockHome,
        __VF_PROJECT_AI_ADAPTER_GEMINI_CLI_PATH__: '/bin/gemini'
      },
      configs: [undefined, undefined],
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
            id: 'skill:workspace:app-builder',
            kind: 'skill',
            name: 'app-builder',
            displayName: 'app-builder',
            origin: 'workspace',
            sourcePath: join(appSkillDir, 'SKILL.md'),
            payload: {
              definition: {
                path: join(appSkillDir, 'SKILL.md'),
                body: '# App Builder\n',
                attributes: {}
              }
            }
          },
          {
            id: 'skill:workspace:frontend-design',
            kind: 'skill',
            name: 'frontend-design',
            displayName: 'frontend-design',
            origin: 'workspace',
            sourcePath: join(dependencySkillDir, 'SKILL.md'),
            payload: {
              definition: {
                path: join(dependencySkillDir, 'SKILL.md'),
                body: '# Frontend Design\n',
                attributes: {}
              }
            }
          }
        ]
      }
    } as any)

    const appSkillPath = join(mockHome, '.agents', 'skills', 'app-builder')
    const dependencySkillPath = join(mockHome, '.agents', 'skills', 'frontend-design')
    expect(resolve(dirname(appSkillPath), await readlink(appSkillPath))).toBe(resolve(appSkillDir))
    expect(resolve(dirname(dependencySkillPath), await readlink(dependencySkillPath))).toBe(resolve(dependencySkillDir))
  })

  it('keeps concurrent Gemini skill sync idempotent when multiple vf processes initialize together', async () => {
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
          if (String(targetPath).endsWith(join('.agents', 'skills'))) {
            await barrier()
          }
          return actual.symlink(...args)
        })
      }
    })

    try {
      const { initGeminiAdapter: initGeminiAdapterWithMockedFs } = await import('../src/runtime/init')
      const ctx = {
        cwd: workspace,
        env: {
          HOME: mockHome,
          __VF_PROJECT_AI_ADAPTER_GEMINI_CLI_PATH__: '/bin/gemini'
        },
        configs: [undefined, undefined],
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
        Promise.all([initGeminiAdapterWithMockedFs(ctx), initGeminiAdapterWithMockedFs(ctx)])
      ).resolves.toHaveLength(2)
      const targetPath = join(mockHome, '.agents', 'skills')
      expect((await lstat(targetPath)).isSymbolicLink()).toBe(true)
      expect(resolve(dirname(targetPath), await readlink(targetPath))).toBe(resolve(workspace, '.ai', 'skills'))
    } finally {
      vi.doUnmock('node:fs/promises')
      vi.resetModules()
    }
  })
})
