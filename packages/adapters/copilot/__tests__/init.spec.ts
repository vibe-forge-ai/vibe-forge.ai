import { lstat, mkdir, mkdtemp, readlink, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { initCopilotAdapter } from '#~/runtime/init.js'

const tempDirs: string[] = []

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
})
