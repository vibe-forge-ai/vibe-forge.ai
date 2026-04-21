import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  persistAdapterAccountArtifacts,
  removeStoredAdapterAccount,
  resolveAdapterAccountReadDirs,
  resolveAdapterAccountReadRoots,
  resolveAdapterAccountsRoot
} from '#~/adapter-account.js'

const tempDirs: string[] = []

const createTempDir = async (prefix: string) => {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

const pathExists = async (targetPath: string) => {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('adapter account utils', () => {
  it('stores adapter account snapshots in the primary worktree when one exists', async () => {
    const primaryDir = await createTempDir('vf-account-primary-')
    const worktreeDir = await createTempDir('vf-account-worktree-')
    const env = {
      __VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__: primaryDir
    }

    expect(resolveAdapterAccountsRoot(worktreeDir, env, 'codex')).toEqual(
      join(primaryDir, '.ai', '.local', 'adapters', 'codex', 'accounts')
    )
  })

  it('writes adapter account artifacts into the shared primary-worktree directory', async () => {
    const primaryDir = await createTempDir('vf-account-primary-')
    const worktreeDir = await createTempDir('vf-account-worktree-')
    const env = {
      __VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__: primaryDir
    }
    const primaryAuthPath = join(
      primaryDir,
      '.ai',
      '.local',
      'adapters',
      'codex',
      'accounts',
      'shared',
      'auth.json'
    )
    const worktreeAuthPath = join(
      worktreeDir,
      '.ai',
      '.local',
      'adapters',
      'codex',
      'accounts',
      'shared',
      'auth.json'
    )

    await persistAdapterAccountArtifacts({
      cwd: worktreeDir,
      env,
      adapter: 'codex',
      account: 'shared',
      artifacts: [
        {
          path: 'auth.json',
          content: '{}'
        }
      ]
    })

    expect(await pathExists(primaryAuthPath)).toBe(true)
    expect(await pathExists(worktreeAuthPath)).toBe(false)
  })

  it('falls back to a legacy current-worktree account directory when the shared root has none', async () => {
    const primaryDir = await createTempDir('vf-account-primary-')
    const worktreeDir = await createTempDir('vf-account-worktree-')
    const env = {
      __VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__: primaryDir
    }

    expect(resolveAdapterAccountReadRoots(worktreeDir, env, 'codex')).toEqual([
      join(primaryDir, '.ai', '.local', 'adapters', 'codex', 'accounts'),
      join(worktreeDir, '.ai', '.local', 'adapters', 'codex', 'accounts')
    ])
    expect(resolveAdapterAccountReadDirs(worktreeDir, env, 'codex', 'shared')).toEqual([
      join(primaryDir, '.ai', '.local', 'adapters', 'codex', 'accounts', 'shared'),
      join(worktreeDir, '.ai', '.local', 'adapters', 'codex', 'accounts', 'shared')
    ])
  })

  it('removes matching account snapshots from both current and primary worktree roots', async () => {
    const primaryDir = await createTempDir('vf-account-primary-')
    const worktreeDir = await createTempDir('vf-account-worktree-')
    const env = {
      __VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__: primaryDir
    }
    const currentAccountDir = join(worktreeDir, '.ai', '.local', 'adapters', 'codex', 'accounts', 'shared')
    const primaryAccountDir = join(primaryDir, '.ai', '.local', 'adapters', 'codex', 'accounts', 'shared')

    await mkdir(currentAccountDir, { recursive: true })
    await mkdir(primaryAccountDir, { recursive: true })
    await writeFile(join(currentAccountDir, 'auth.json'), '{}')
    await writeFile(join(primaryAccountDir, 'auth.json'), '{}')

    await removeStoredAdapterAccount({
      cwd: worktreeDir,
      env,
      adapter: 'codex',
      account: 'shared'
    })

    expect(await pathExists(currentAccountDir)).toBe(false)
    expect(await pathExists(primaryAccountDir)).toBe(false)
  })
})
