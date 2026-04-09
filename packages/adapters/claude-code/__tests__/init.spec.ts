import { lstat, mkdir, mkdtemp, readlink, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { initClaudeCodeAdapter } from '../src/claude/init'

const tempDirs: string[] = []

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
    expect(resolve(dirname(keychainsPath), await readlink(keychainsPath))).toBe(resolve(realHome, 'Library', 'Keychains'))
  })
})
