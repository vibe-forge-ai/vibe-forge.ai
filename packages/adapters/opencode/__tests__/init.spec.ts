import { lstat, mkdir, mkdtemp, readlink, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { initOpenCodeAdapter } from '../src/runtime/init'

const tempDirs: string[] = []

const createWorkspace = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'opencode-init-'))
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
  delete process.env.__VF_PROJECT_REAL_HOME__
  delete process.env.HOME
  vi.doUnmock('node:fs/promises')
  vi.resetModules()
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('initOpenCodeAdapter', () => {
  it('symlinks real-home auth files into the shared OpenCode mock home', async () => {
    const workspace = await createWorkspace()
    const realHome = await createWorkspace()
    const mockHome = join(workspace, '.ai', '.mock')

    await mkdir(join(realHome, '.local', 'share', 'opencode'), { recursive: true })
    await writeFile(join(realHome, '.local', 'share', 'opencode', 'auth.json'), '{}\n')
    await writeFile(join(realHome, '.local', 'share', 'opencode', 'mcp-auth.json'), '{}\n')
    process.env.__VF_PROJECT_REAL_HOME__ = realHome
    process.env.HOME = mockHome

    await initOpenCodeAdapter({
      cwd: workspace,
      env: {},
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

    const authPath = join(mockHome, '.local', 'share', 'opencode', 'auth.json')
    expect((await lstat(authPath)).isSymbolicLink()).toBe(true)
    expect(resolve(dirname(authPath), await readlink(authPath))).toBe(
      resolve(realHome, '.local', 'share', 'opencode', 'auth.json')
    )
  })

  it('keeps concurrent auth sync idempotent when multiple vf processes initialize OpenCode together', async () => {
    const workspace = await createWorkspace()
    const realHome = await createWorkspace()
    const mockHome = join(workspace, '.ai', '.mock')
    const barrier = createBarrier(2)

    await mkdir(join(realHome, '.local', 'share', 'opencode'), { recursive: true })
    await writeFile(join(realHome, '.local', 'share', 'opencode', 'auth.json'), '{}\n')
    process.env.__VF_PROJECT_REAL_HOME__ = realHome
    process.env.HOME = mockHome

    vi.resetModules()
    vi.doMock('node:fs/promises', async (importOriginal) => {
      const actual = await importOriginal<typeof import('node:fs/promises')>()
      return {
        ...actual,
        symlink: vi.fn(async (...args: Parameters<typeof actual.symlink>) => {
          const [, targetPath] = args
          if (String(targetPath).endsWith(join('opencode', 'auth.json'))) {
            await barrier()
          }
          return actual.symlink(...args)
        })
      }
    })

    try {
      const { initOpenCodeAdapter: initOpenCodeAdapterWithMockedFs } = await import('../src/runtime/init')
      const ctx = {
        cwd: workspace,
        env: {},
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
        Promise.all([initOpenCodeAdapterWithMockedFs(ctx), initOpenCodeAdapterWithMockedFs(ctx)])
      ).resolves.toHaveLength(2)
      const authPath = join(mockHome, '.local', 'share', 'opencode', 'auth.json')
      expect((await lstat(authPath)).isSymbolicLink()).toBe(true)
      expect(resolve(dirname(authPath), await readlink(authPath))).toBe(
        resolve(realHome, '.local', 'share', 'opencode', 'auth.json')
      )
    } finally {
      vi.doUnmock('node:fs/promises')
      vi.resetModules()
    }
  })
})
