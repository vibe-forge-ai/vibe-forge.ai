import { execFile } from 'node:child_process'
import { access, mkdir, rm, symlink } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'

import { resolveMockHome } from '@vibe-forge/hooks'
import type { AdapterCtx } from '@vibe-forge/types'

import { resolveCodexBinaryPath } from '#~/paths.js'
import { ensureCodexNativeHooksInstalled } from './native-hooks'

const execFileAsync = promisify(execFile)

/**
 * Symlink `<home>/.codex/auth.json` into `<aiHome>/.codex/auth.json` so
 * the codex process can authenticate when HOME is redirected to `.ai/.mock`.
 */
async function linkAuthFile(home: string, mockHome: string): Promise<void> {
  const realAuth = join(home, '.codex', 'auth.json')
  const aiCodexDir = join(mockHome, '.codex')
  const aiAuth = join(aiCodexDir, 'auth.json')

  // Ensure the .codex directory exists inside the AI home
  await mkdir(aiCodexDir, { recursive: true })

  // Check if the real auth.json exists
  try {
    await access(realAuth)
  } catch {
    return
  }

  // Check if the target already exists (symlink or file)
  try {
    await access(aiAuth)
    return
  } catch {
    // Doesn't exist yet — create the symlink
  }

  await symlink(realAuth, aiAuth)
}

async function syncCodexMockHomeSkills(ctx: Pick<AdapterCtx, 'cwd' | 'env'>): Promise<void> {
  const sourceDir = resolve(ctx.cwd, '.ai', 'skills')
  const targetDir = resolve(resolveMockHome(ctx.cwd, ctx.env), '.agents', 'skills')

  try {
    await access(sourceDir)
  } catch {
    await rm(targetDir, { recursive: true, force: true })
    return
  }

  await rm(targetDir, { recursive: true, force: true })
  await mkdir(dirname(targetDir), { recursive: true })
  await symlink(sourceDir, targetDir, 'dir')
}

/**
 * Initialize the Codex adapter.
 *
 * Unlike the claude-code adapter (which generates a CCR config.json and
 * restarts a router), the Codex adapter manages its own `~/.codex/config.toml`
 * and accepts all configuration as per-connection or per-turn overrides in the
 * JSON-RPC protocol.
 *
 * This init step:
 *   1. Verifies that the `codex` binary is reachable.
 *   2. Symlinks the real `~/.codex/auth.json` into the mock HOME directory so
 *      authentication works under HOME isolation.
 *   3. Installs a workspace-local native hooks bridge into the mock Codex home.
 */
export const initCodexAdapter = async (ctx: AdapterCtx) => {
  const { env } = ctx

  const home = ctx.env.__VF_PROJECT_REAL_HOME__?.trim() || process.env.__VF_PROJECT_REAL_HOME__?.trim()
  const mockHome = resolveMockHome(ctx.cwd, ctx.env)

  const binaryPath = resolveCodexBinaryPath(env)

  try {
    await execFileAsync(String(binaryPath), ['--version'])
  } catch {
    // Non-fatal: the binary might not be installed globally, or it might be
    // installed but the --version flag might not exist in older builds.
  }

  if (home != null && home !== '') {
    await linkAuthFile(home, mockHome)
  }
  await syncCodexMockHomeSkills(ctx)
  await ensureCodexNativeHooksInstalled(ctx)
}
