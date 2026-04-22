import { chmod, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { resolveManagedNpmCliPaths } from '@vibe-forge/utils/managed-npm-cli'

import {
  CLAUDE_CODE_CLI_PACKAGE,
  CLAUDE_CODE_CLI_VERSION,
  CLAUDE_CODE_ROUTER_CLI_PACKAGE,
  CLAUDE_CODE_ROUTER_CLI_VERSION,
  resolveAdapterCliPath,
  resolveClaudeCliPath
} from '../src/ccr/paths'

describe('claude code CLI paths', () => {
  it('uses a managed Claude binary from the primary workspace shared cache', async () => {
    const primary = await mkdtemp(join(tmpdir(), 'vf-claude-primary-'))
    const worktree = await mkdtemp(join(tmpdir(), 'vf-claude-worktree-'))
    try {
      const env = {
        __VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__: primary
      }
      const paths = resolveManagedNpmCliPaths({
        adapterKey: 'claude_code',
        binaryName: 'claude',
        cwd: worktree,
        env,
        packageName: CLAUDE_CODE_CLI_PACKAGE,
        version: CLAUDE_CODE_CLI_VERSION
      })
      await mkdir(paths.binDir, { recursive: true })
      await writeFile(paths.binaryPath, '#!/bin/sh\n')
      await chmod(paths.binaryPath, 0o755)

      expect(resolveClaudeCliPath(worktree, env)).toBe(await realpath(paths.binaryPath))
    } finally {
      await rm(primary, { recursive: true, force: true })
      await rm(worktree, { recursive: true, force: true })
    }
  })

  it('uses a managed Claude Code Router binary from the primary workspace shared cache', async () => {
    const primary = await mkdtemp(join(tmpdir(), 'vf-ccr-primary-'))
    const worktree = await mkdtemp(join(tmpdir(), 'vf-ccr-worktree-'))
    try {
      const env = {
        __VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__: primary
      }
      const paths = resolveManagedNpmCliPaths({
        adapterKey: 'claude_code_router',
        binaryName: 'ccr',
        cwd: worktree,
        env,
        packageName: CLAUDE_CODE_ROUTER_CLI_PACKAGE,
        version: CLAUDE_CODE_ROUTER_CLI_VERSION
      })
      await mkdir(paths.binDir, { recursive: true })
      await writeFile(paths.binaryPath, '#!/bin/sh\n')
      await chmod(paths.binaryPath, 0o755)

      expect(resolveAdapterCliPath(worktree, env)).toBe(await realpath(paths.binaryPath))
    } finally {
      await rm(primary, { recursive: true, force: true })
      await rm(worktree, { recursive: true, force: true })
    }
  })
})
