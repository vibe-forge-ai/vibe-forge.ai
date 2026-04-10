import { lstat, mkdir, mkdtemp, readFile, readlink, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { initCodexAdapter } from '../src/runtime/init'

const tempDirs: string[] = []

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
})
