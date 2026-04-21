import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)

describe('loadDotenv', () => {
  const restoreKeys = ['TEST_PRIMARY_ONLY', 'TEST_SHARED_VALUE', 'TEST_CONFIG_ONLY']
  const restoreEnv = new Map<string, string | undefined>()
  const restoreScopedEnv = [
    '__VF_PROJECT_LAUNCH_CWD__',
    '__VF_PROJECT_WORKSPACE_FOLDER__',
    '__VF_PROJECT_CONFIG_DIR__',
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

  it('loads config-dir env files after launch-dir env sets workspace and config overrides', async () => {
    const workspaceDir = await mkdtemp(path.join(os.tmpdir(), 'vf-dotenv-workspace-'))
    const launchDir = path.join(workspaceDir, 'c', 'd', 'e')
    const configDir = path.join(launchDir, '.iac', 'ai')
    const previousCwd = process.cwd()

    for (const key of restoreKeys) {
      restoreEnv.set(key, process.env[key])
      delete process.env[key]
    }
    for (const key of restoreScopedEnv) {
      restoreScopedValues.set(key, process.env[key])
    }

    try {
      await mkdir(configDir, { recursive: true })
      await writeFile(
        path.join(launchDir, '.env'),
        [
          '__VF_PROJECT_WORKSPACE_FOLDER__=../../..',
          '__VF_PROJECT_CONFIG_DIR__=.iac/ai'
        ].join('\n')
      )
      await writeFile(
        path.join(configDir, '.env.dev'),
        'TEST_CONFIG_ONLY=config-value\n'
      )

      process.chdir(launchDir)

      const modulePath = require.resolve('../dotenv.js')
      delete require.cache[modulePath]
      const {
        loadDotenv,
        resolveProjectWorkspaceFolder,
        resolveProjectConfigDir
      } = require(modulePath) as {
        loadDotenv: (options?: { workspaceFolder?: string; files?: string[] }) => void
        resolveProjectWorkspaceFolder: (cwd?: string, env?: NodeJS.ProcessEnv) => string
        resolveProjectConfigDir: (cwd?: string, env?: NodeJS.ProcessEnv) => string | undefined
      }

      delete process.env.TEST_CONFIG_ONLY
      loadDotenv()

      const realWorkspaceDir = await realpath(workspaceDir)
      const realConfigDir = await realpath(configDir)
      expect(process.env.TEST_CONFIG_ONLY).toBe('config-value')
      expect(resolveProjectWorkspaceFolder(process.cwd(), process.env)).toBe(realWorkspaceDir)
      expect(resolveProjectConfigDir(process.cwd(), process.env)).toBe(realConfigDir)
    } finally {
      process.chdir(previousCwd)
      await rm(workspaceDir, { force: true, recursive: true })
    }
  })

  it('loads env files from the detected workspace root when given a nested startup directory', async () => {
    const workspaceDir = await mkdtemp(path.join(os.tmpdir(), 'vf-dotenv-root-'))
    const nestedDir = path.join(workspaceDir, 'packages', 'demo', 'src')

    for (const key of restoreKeys) {
      restoreEnv.set(key, process.env[key])
      delete process.env[key]
    }
    for (const key of restoreScopedEnv) {
      restoreScopedValues.set(key, process.env[key])
      delete process.env[key]
    }

    try {
      await mkdir(nestedDir, { recursive: true })
      await writeFile(path.join(workspaceDir, '.ai.config.json'), '{}\n')
      await writeFile(path.join(workspaceDir, '.env'), 'TEST_PRIMARY_ONLY=nested-root\nTEST_SHARED_VALUE=root\n')

      const modulePath = require.resolve('../dotenv.js')
      delete require.cache[modulePath]
      const {
        loadDotenv,
        resolveProjectWorkspaceFolder
      } = require(modulePath) as {
        loadDotenv: (options?: { workspaceFolder?: string; files?: string[] }) => void
        resolveProjectWorkspaceFolder: (cwd?: string, env?: NodeJS.ProcessEnv) => string
      }

      delete process.env.TEST_PRIMARY_ONLY
      delete process.env.TEST_SHARED_VALUE
      loadDotenv({ workspaceFolder: nestedDir })

      expect(process.env.TEST_PRIMARY_ONLY).toBe('nested-root')
      expect(process.env.TEST_SHARED_VALUE).toBe('root')
      expect(resolveProjectWorkspaceFolder(nestedDir, process.env)).toBe(await realpath(workspaceDir))
    } finally {
      await rm(workspaceDir, { force: true, recursive: true })
    }
  })
})
