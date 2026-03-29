import { existsSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

import type { AdapterCtx } from '@vibe-forge/types'

const require = createRequire(import.meta.url ?? __filename)
const adapterPackageDir = dirname(require.resolve('@vibe-forge/adapter-opencode/package.json'))

export const toRealPath = (targetPath: string) => {
  try {
    return realpathSync(targetPath)
  } catch {
    return targetPath
  }
}

export const resolveOpenCodeBinaryPath = (env: AdapterCtx['env']): string => {
  const envPath = env.__VF_PROJECT_AI_ADAPTER_OPENCODE_CLI_PATH__
  if (typeof envPath === 'string' && envPath.trim() !== '') {
    return envPath
  }

  const bundledPath = resolve(adapterPackageDir, 'node_modules/.bin/opencode')
  if (existsSync(bundledPath)) {
    return toRealPath(bundledPath)
  }

  return 'opencode'
}
