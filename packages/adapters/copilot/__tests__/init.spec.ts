import { lstat, mkdir, mkdtemp, readlink, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { initCopilotAdapter } from '#~/runtime/init.js'

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
  const dir = await mkdtemp(join(tmpdir(), 'copilot-init-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('initCopilotAdapter', () => {
  it('symlinks macOS keychains into the isolated mock home and replaces an existing mock-home directory', async () => {
    const workspace = await createWorkspace()
    const realHome = await createWorkspace()
    const mockHome = join(workspace, '.ai', '.mock')
    const keychainsPath = join(mockHome, 'Library', 'Keychains')

    await mkdir(join(realHome, 'Library', 'Keychains'), { recursive: true })
    await writeFile(join(realHome, 'Library', 'Keychains', 'login.keychain-db'), '')
    await mkdir(keychainsPath, { recursive: true })
    await writeFile(join(keychainsPath, 'stale.keychain-db'), '')

    await initCopilotAdapter({
      cwd: workspace,
      env: {
        HOME: mockHome,
        __VF_PROJECT_REAL_HOME__: realHome,
        __VF_PROJECT_AI_ADAPTER_COPILOT_CLI_PATH__: '/bin/copilot'
      },
      configs: [undefined, undefined],
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      }
    } as any)

    expect((await lstat(keychainsPath)).isSymbolicLink()).toBe(true)
    expect(resolve(dirname(keychainsPath), await readlink(keychainsPath))).toBe(
      resolve(realHome, 'Library', 'Keychains')
    )
  })

  it('removes stale keychains entries when the real home keychains directory is unavailable', async () => {
    const workspace = await createWorkspace()
    const realHome = await createWorkspace()
    const mockHome = join(workspace, '.ai', '.mock')
    const keychainsPath = join(mockHome, 'Library', 'Keychains')

    await mkdir(keychainsPath, { recursive: true })
    await writeFile(join(keychainsPath, 'stale.keychain-db'), '')

    await initCopilotAdapter({
      cwd: workspace,
      env: {
        HOME: mockHome,
        __VF_PROJECT_REAL_HOME__: realHome,
        __VF_PROJECT_AI_ADAPTER_COPILOT_CLI_PATH__: '/bin/copilot'
      },
      configs: [undefined, undefined],
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      }
    } as any)

    await expect(lstat(keychainsPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('still writes keychain links into the workspace mock home when HOME points at the workspace root', async () => {
    const workspace = await createWorkspace()
    const realHome = await createWorkspace()
    const mockHome = join(workspace, '.ai', '.mock')
    const keychainsPath = join(mockHome, 'Library', 'Keychains')

    await mkdir(join(realHome, 'Library', 'Keychains'), { recursive: true })
    await writeFile(join(realHome, 'Library', 'Keychains', 'login.keychain-db'), '')

    await initCopilotAdapter({
      cwd: workspace,
      env: {
        HOME: workspace,
        __VF_PROJECT_REAL_HOME__: realHome,
        __VF_PROJECT_AI_ADAPTER_COPILOT_CLI_PATH__: '/bin/copilot'
      },
      configs: [undefined, undefined],
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      }
    } as any)

    expect((await lstat(keychainsPath)).isSymbolicLink()).toBe(true)
    await expect(lstat(join(workspace, 'Library', 'Keychains'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('keeps concurrent keychain sync idempotent when multiple vf processes initialize Copilot together', async () => {
    const workspace = await createWorkspace()
    const realHome = await createWorkspace()
    const mockHome = join(workspace, '.ai', '.mock')
    const barrier = createBarrier(2)

    await mkdir(join(realHome, 'Library', 'Keychains'), { recursive: true })
    await writeFile(join(realHome, 'Library', 'Keychains', 'login.keychain-db'), '')

    vi.resetModules()
    vi.doMock('node:fs/promises', async (importOriginal) => {
      const actual = await importOriginal<typeof import('node:fs/promises')>()
      return {
        ...actual,
        symlink: vi.fn(async (...args: Parameters<typeof actual.symlink>) => {
          const [, targetPath] = args
          if (String(targetPath).endsWith(join('Library', 'Keychains'))) {
            await barrier()
          }
          return actual.symlink(...args)
        })
      }
    })

    try {
      const { initCopilotAdapter: initCopilotAdapterWithMockedFs } = await import('#~/runtime/init.js')
      const ctx = {
        cwd: workspace,
        env: {
          HOME: mockHome,
          __VF_PROJECT_REAL_HOME__: realHome,
          __VF_PROJECT_AI_ADAPTER_COPILOT_CLI_PATH__: '/bin/copilot'
        },
        configs: [undefined, undefined],
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn()
        }
      } as any

      await expect(
        Promise.all([initCopilotAdapterWithMockedFs(ctx), initCopilotAdapterWithMockedFs(ctx)])
      ).resolves.toHaveLength(2)
      const keychainsPath = join(mockHome, 'Library', 'Keychains')
      expect((await lstat(keychainsPath)).isSymbolicLink()).toBe(true)
      expect(resolve(dirname(keychainsPath), await readlink(keychainsPath))).toBe(
        resolve(realHome, 'Library', 'Keychains')
      )
    } finally {
      vi.doUnmock('node:fs/promises')
      vi.resetModules()
    }
  })
})
