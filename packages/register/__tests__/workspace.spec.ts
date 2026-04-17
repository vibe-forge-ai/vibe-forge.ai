import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)

describe('workspace root resolver', () => {
  const restoreKeys = [
    '__VF_PROJECT_AI_BASE_DIR__',
    '__VF_PROJECT_WORKSPACE_FOLDER__'
  ] as const
  const restoreValues = new Map<string, string | undefined>()

  afterEach(() => {
    for (const key of restoreKeys) {
      const previousValue = restoreValues.get(key)
      if (previousValue == null) {
        delete process.env[key]
      } else {
        process.env[key] = previousValue
      }
    }
    restoreValues.clear()
  })

  it('finds the nearest configured workspace root instead of stopping at a nested package', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'vf-workspace-root-'))
    const nestedDir = path.join(workspaceRoot, 'packages', 'demo', 'src')
    const realWorkspaceRoot = await realpath(workspaceRoot)

    for (const key of restoreKeys) {
      restoreValues.set(key, process.env[key])
    }

    try {
      await mkdir(path.join(workspaceRoot, '.ai'), { recursive: true })
      await mkdir(nestedDir, { recursive: true })
      await writeFile(path.join(workspaceRoot, 'package.json'), '{"name":"root"}\n')
      await writeFile(path.join(workspaceRoot, 'packages', 'demo', 'package.json'), '{"name":"demo"}\n')

      const modulePath = require.resolve('../workspace.js')
      delete require.cache[modulePath]
      const { findWorkspaceRoot } = require(modulePath) as {
        findWorkspaceRoot: (startDir?: string) => string
      }

      expect(findWorkspaceRoot(nestedDir)).toBe(realWorkspaceRoot)
    } finally {
      await rm(workspaceRoot, { force: true, recursive: true })
    }
  })

  it('falls back to the git root when no workspace markers are present', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'vf-workspace-git-'))
    const nestedDir = path.join(workspaceRoot, 'packages', 'demo', 'src')
    const realWorkspaceRoot = await realpath(workspaceRoot)

    for (const key of restoreKeys) {
      restoreValues.set(key, process.env[key])
    }

    try {
      await mkdir(nestedDir, { recursive: true })
      await writeFile(path.join(workspaceRoot, 'package.json'), '{"name":"root"}\n')
      await writeFile(path.join(workspaceRoot, 'packages', 'demo', 'package.json'), '{"name":"demo"}\n')

      const initResult = spawnSync('git', ['init'], {
        cwd: workspaceRoot,
        encoding: 'utf8'
      })
      expect(initResult.status).toBe(0)

      const modulePath = require.resolve('../workspace.js')
      delete require.cache[modulePath]
      const { findWorkspaceRoot } = require(modulePath) as {
        findWorkspaceRoot: (startDir?: string) => string
      }

      expect(findWorkspaceRoot(nestedDir)).toBe(realWorkspaceRoot)
    } finally {
      await rm(workspaceRoot, { force: true, recursive: true })
    }
  })

  it('respects an explicit workspace folder override', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'vf-workspace-explicit-'))
    const nestedDir = path.join(workspaceRoot, 'src', 'nested')
    const realNestedDir = await realpath(path.join(workspaceRoot))

    for (const key of restoreKeys) {
      restoreValues.set(key, process.env[key])
    }

    try {
      await mkdir(nestedDir, { recursive: true })
      process.env.__VF_PROJECT_WORKSPACE_FOLDER__ = nestedDir

      const modulePath = require.resolve('../workspace.js')
      delete require.cache[modulePath]
      const { resolveWorkspaceFolder } = require(modulePath) as {
        resolveWorkspaceFolder: (startDir?: string) => string
      }

      expect(resolveWorkspaceFolder(workspaceRoot)).toBe(path.join(realNestedDir, 'src', 'nested'))
    } finally {
      await rm(workspaceRoot, { force: true, recursive: true })
    }
  })
})
