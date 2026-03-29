import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

import type { AdapterCtx } from '@vibe-forge/types'

const require = createRequire(import.meta.url ?? __filename)
const adapterPackageDir = dirname(require.resolve('@vibe-forge/adapter-codex/package.json'))

/**
 * Returns the path to the codex binary.
 *
 * Resolution order:
 *   1. `__VF_PROJECT_AI_ADAPTER_CODEX_CLI_PATH__` env override
 *   2. `<adapterPackageDir>/node_modules/.bin/codex`  (bundled via @openai/codex dependency)
 */
export const resolveCodexBinaryPath = (env: AdapterCtx['env']): string => {
  const envPath = env.__VF_PROJECT_AI_ADAPTER_CODEX_CLI_PATH__
  return typeof envPath === 'string' && envPath !== ''
    ? envPath
    : resolve(adapterPackageDir, 'node_modules/.bin/codex')
}
