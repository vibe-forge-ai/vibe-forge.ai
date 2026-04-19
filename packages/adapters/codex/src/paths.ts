import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

import type { AdapterCtx } from '@vibe-forge/types'
import { resolveManagedNpmCliBinaryPath } from '@vibe-forge/utils/managed-npm-cli'

const require = createRequire(import.meta.url ?? __filename)
const adapterPackageDir = dirname(require.resolve('@vibe-forge/adapter-codex/package.json'))
const bundledPath = resolve(adapterPackageDir, 'node_modules/.bin/codex')

export const CODEX_CLI_PACKAGE = '@openai/codex'
export const CODEX_CLI_VERSION = '0.121.0'

/**
 * Returns the path to the codex binary.
 *
 * Resolution order:
 *   1. `__VF_PROJECT_AI_ADAPTER_CODEX_CLI_PATH__` env override
 *   2. primary workspace managed CLI cache
 *   3. `<adapterPackageDir>/node_modules/.bin/codex`  (bundled compatibility fallback)
 *   4. `codex` on PATH
 */
export const resolveCodexBinaryPath = (
  env: AdapterCtx['env'],
  cwd?: string
): string =>
  resolveManagedNpmCliBinaryPath({
    adapterKey: 'codex',
    binaryName: 'codex',
    bundledPath: existsSync(bundledPath) ? bundledPath : undefined,
    cwd,
    defaultPackageName: CODEX_CLI_PACKAGE,
    defaultVersion: CODEX_CLI_VERSION,
    env
  })
