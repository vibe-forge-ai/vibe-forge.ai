import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)

describe('loadDotenv', () => {
  const restoreKeys = ['TEST_PRIMARY_ONLY', 'TEST_SHARED_VALUE']
  const restoreEnv = new Map<string, string | undefined>()
  const restoreScopedEnv = [
    '__VF_PROJECT_WORKSPACE_FOLDER__',
    '__VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__',
    '__VF_PROJECT_DOTENV_FILES__',
    '__VF_PROJECT_PACKAGE_DIR__'
  ] as const
  const restoreScopedValues = new Map<string, string | undefined>()

  afterEach(() => {
    for (const key of restoreKeys) {
      const previousValue = restoreEnv.get(key)
      if (previousValue == null) {
        delete process.env[key]
      } else {
        process.env[key] = previousValue
      }
    }
    restoreEnv.clear()

    for (const key of restoreScopedEnv) {
      const previousValue = restoreScopedValues.get(key)
      if (previousValue == null) {
        delete process.env[key]
      } else {
        process.env[key] = previousValue
      }
    }
    restoreScopedValues.clear()
  })

  it('falls back to the primary workspace env file when the current worktree has none', async () => {
    const primaryDir = await mkdtemp(path.join(os.tmpdir(), 'vf-dotenv-primary-'))
    const worktreeDir = await mkdtemp(path.join(os.tmpdir(), 'vf-dotenv-worktree-'))

    for (const key of restoreKeys) {
      restoreEnv.set(key, process.env[key])
      delete process.env[key]
    }
    for (const key of restoreScopedEnv) {
      restoreScopedValues.set(key, process.env[key])
    }

    try {
      await writeFile(
        path.join(primaryDir, '.env'),
        'TEST_PRIMARY_ONLY=primary-value\nTEST_SHARED_VALUE=primary-shared\n'
      )
      await writeFile(
        path.join(worktreeDir, '.env'),
        'TEST_SHARED_VALUE=worktree-shared\n'
      )

      process.env.__VF_PROJECT_WORKSPACE_FOLDER__ = worktreeDir
      process.env.__VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__ = primaryDir
      delete process.env.__VF_PROJECT_PACKAGE_DIR__

      const modulePath = require.resolve('../dotenv.js')
      delete require.cache[modulePath]
      const { loadDotenv } = require(modulePath) as {
        loadDotenv: (options?: { workspaceFolder?: string; files?: string[] }) => void
      }

      delete process.env.TEST_PRIMARY_ONLY
      delete process.env.TEST_SHARED_VALUE
      loadDotenv({ workspaceFolder: worktreeDir })

      expect(process.env.TEST_PRIMARY_ONLY).toBe('primary-value')
      expect(process.env.TEST_SHARED_VALUE).toBe('worktree-shared')
    } finally {
      await rm(primaryDir, { force: true, recursive: true })
      await rm(worktreeDir, { force: true, recursive: true })
    }
  })
})
