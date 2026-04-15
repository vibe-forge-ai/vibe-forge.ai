import { existsSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

import type { AdapterCtx } from '@vibe-forge/types'

const require = createRequire(import.meta.url ?? __filename)
const adapterPackageDir = dirname(require.resolve('@vibe-forge/adapter-copilot/package.json'))

const toRealPath = (targetPath: string) => {
  try {
    return realpathSync(targetPath)
  } catch {
    return targetPath
  }
}

export const resolveCopilotBinaryPath = (env: AdapterCtx['env'], configuredPath?: string): string => {
  const envPath = env.__VF_PROJECT_AI_ADAPTER_COPILOT_CLI_PATH__
  if (typeof envPath === 'string' && envPath.trim() !== '') {
    return envPath
  }

  if (configuredPath != null && configuredPath.trim() !== '') {
    return configuredPath
  }

  const bundledPath = resolve(adapterPackageDir, 'node_modules/.bin/copilot')
  if (existsSync(bundledPath)) {
    return toRealPath(bundledPath)
  }

  return 'copilot'
}
