import { execFile } from 'node:child_process'
import { access, mkdir, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'

import type { AdapterCtx, AdapterInitOptions } from '@vibe-forge/core/adapter'

import { resolveCodexBinaryPath } from '#~/paths.js'

const execFileAsync = promisify(execFile)

/**
 * Symlink `<home>/.codex/auth.json` into `<aiHome>/.codex/auth.json` so
 * the codex process can authenticate when HOME is redirected to `.ai/.mock`.
 */
async function linkAuthFile(home: string, logger: AdapterCtx['logger']): Promise<void> {
  const realAuth = join(home, '.codex', 'auth.json')
  const aiCodexDir = join(process.env.HOME!, '.codex')
  const aiAuth = join(aiCodexDir, 'auth.json')

  // Ensure the .codex directory exists inside the AI home
  await mkdir(aiCodexDir, { recursive: true })

  // Check if the real auth.json exists
  try {
    await access(realAuth)
  } catch {
    logger.info('[codex init] no auth.json found in HOME, skipping symlink', { realAuth })
    return
  }

  // Check if the target already exists (symlink or file)
  try {
    await access(aiAuth)
    logger.info('[codex init] auth.json already present in aiHome, skipping symlink', { aiAuth })
    return
  } catch {
    // Doesn't exist yet — create the symlink
  }

  await symlink(realAuth, aiAuth)
  logger.info('[codex init] symlinked auth.json into aiHome', { realAuth, aiAuth })
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
 */
export const initCodexAdapter = async (ctx: AdapterCtx, _options: AdapterInitOptions) => {
  const { env, logger } = ctx

  const home = process.env.__VF_PROJECT_REAL_HOME__!

  const binaryPath = resolveCodexBinaryPath(env)

  logger.info('[codex init] resolved paths', {
    binaryPath,
    home
  })

  try {
    const { stdout } = await execFileAsync(String(binaryPath), ['--version'])
    logger.info('[codex init] binary found', { version: stdout.trim(), binaryPath })
  } catch (err) {
    // Non-fatal: the binary might not be installed globally, or it might be
    // installed but the --version flag might not exist in older builds.
    logger.warn('[codex init] could not verify codex binary', { err, binaryPath })
  }

  await linkAuthFile(home, logger)
}
