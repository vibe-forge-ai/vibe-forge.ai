import { chmod, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { resolveManagedNpmCliPaths } from '@vibe-forge/utils/managed-npm-cli'

import { COPILOT_CLI_PACKAGE, COPILOT_CLI_VERSION, resolveCopilotBinaryPath } from '#~/paths.js'

describe('resolveCopilotBinaryPath', () => {
  it('pins the managed Copilot CLI to the latest stable version', () => {
    expect(COPILOT_CLI_VERSION).toBe('1.0.36')
  })

  it('returns the env-specified path when set', () => {
    expect(resolveCopilotBinaryPath({
      __VF_PROJECT_AI_ADAPTER_COPILOT_CLI_PATH__: '/usr/local/bin/copilot'
    })).toBe('/usr/local/bin/copilot')
  })

  it('uses a managed binary from the primary workspace shared cache', async () => {
    const primary = await mkdtemp(join(tmpdir(), 'vf-copilot-primary-'))
    const worktree = await mkdtemp(join(tmpdir(), 'vf-copilot-worktree-'))
    try {
      const env = {
        __VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__: primary
      }
      const paths = resolveManagedNpmCliPaths({
        adapterKey: 'copilot',
        binaryName: 'copilot',
        cwd: worktree,
        env,
        packageName: COPILOT_CLI_PACKAGE,
        version: COPILOT_CLI_VERSION
      })
      await mkdir(paths.binDir, { recursive: true })
      await writeFile(paths.binaryPath, '#!/bin/sh\n')
      await chmod(paths.binaryPath, 0o755)

      expect(resolveCopilotBinaryPath(env, undefined, worktree)).toBe(await realpath(paths.binaryPath))
    } finally {
      await rm(primary, { recursive: true, force: true })
      await rm(worktree, { recursive: true, force: true })
    }
  })
})
