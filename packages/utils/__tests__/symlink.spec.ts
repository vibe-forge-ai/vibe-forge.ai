import { lstat, mkdir, mkdtemp, readlink, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

const tempDirs: string[] = []

const createTempDir = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vf-symlink-'))
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

describe('syncSymlinkTarget', () => {
  it('links the requested target and reuses an existing correct symlink', async () => {
    const workspace = await createTempDir()
    const sourceDir = join(workspace, 'source')
    const targetDir = join(workspace, 'target')

    await mkdir(sourceDir, { recursive: true })

    const { syncSymlinkTarget } = await import('#~/symlink.js')

    await expect(syncSymlinkTarget({ sourcePath: sourceDir, targetPath: targetDir, type: 'dir' })).resolves.toBe(
      'linked'
    )
    await expect(syncSymlinkTarget({ sourcePath: sourceDir, targetPath: targetDir, type: 'dir' })).resolves.toBe(
      'unchanged'
    )
    expect((await lstat(targetDir)).isSymbolicLink()).toBe(true)
    expect(resolve(dirname(targetDir), await readlink(targetDir))).toBe(resolve(sourceDir))
  })

  it('removes a stale target when asked to clean up missing sources', async () => {
    const workspace = await createTempDir()
    const sourceDir = join(workspace, 'missing-source')
    const targetDir = join(workspace, 'target')

    await mkdir(targetDir, { recursive: true })
    await writeFile(join(targetDir, 'stale.txt'), 'stale\n')

    const { syncSymlinkTarget } = await import('#~/symlink.js')

    await expect(
      syncSymlinkTarget({
        sourcePath: sourceDir,
        targetPath: targetDir,
        type: 'dir',
        onMissingSource: 'remove'
      })
    ).resolves.toBe('removed')
    await expect(lstat(targetDir)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('treats concurrent creation of the same symlink as success', async () => {
    const workspace = await createTempDir()
    const sourceDir = join(workspace, 'source')
    const targetDir = join(workspace, 'target')
    const barrier = createBarrier(2)

    await mkdir(sourceDir, { recursive: true })

    vi.doMock('node:fs/promises', async (importOriginal) => {
      const actual = await importOriginal<typeof import('node:fs/promises')>()
      return {
        ...actual,
        symlink: vi.fn(async (...args: Parameters<typeof actual.symlink>) => {
          const [, targetPath] = args
          if (String(targetPath) === targetDir) {
            await barrier()
          }
          return actual.symlink(...args)
        })
      }
    })

    const { syncSymlinkTarget } = await import('#~/symlink.js')

    await expect(
      Promise.all([
        syncSymlinkTarget({ sourcePath: sourceDir, targetPath: targetDir, type: 'dir' }),
        syncSymlinkTarget({ sourcePath: sourceDir, targetPath: targetDir, type: 'dir' })
      ])
    ).resolves.toEqual(expect.arrayContaining(['linked', 'unchanged']))
    expect((await lstat(targetDir)).isSymbolicLink()).toBe(true)
    expect(resolve(dirname(targetDir), await readlink(targetDir))).toBe(resolve(sourceDir))
  })
})
