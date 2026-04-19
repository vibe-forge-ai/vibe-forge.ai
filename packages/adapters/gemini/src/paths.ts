import { existsSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

import type { AdapterCtx } from '@vibe-forge/types'
import { resolveManagedNpmCliBinaryPath } from '@vibe-forge/utils/managed-npm-cli'

const require = createRequire(import.meta.url ?? __filename)
const adapterPackageDir = dirname(require.resolve('@vibe-forge/adapter-gemini/package.json'))
const bundledPath = resolve(adapterPackageDir, 'node_modules/.bin/gemini')

export const GEMINI_CLI_PACKAGE = '@google/gemini-cli'
export const GEMINI_CLI_VERSION = '0.38.2'

const toRealPath = (targetPath: string) => {
  try {
    return realpathSync(targetPath)
  } catch {
    return targetPath
  }
}

export const resolveGeminiBinaryPath = (
  env: AdapterCtx['env'],
  cwd?: string
) => {
  const envPath = env.__VF_PROJECT_AI_ADAPTER_GEMINI_CLI_PATH__
  if (typeof envPath === 'string' && envPath.trim() !== '') {
    return envPath
  }

  return resolveManagedNpmCliBinaryPath({
    adapterKey: 'gemini',
    binaryName: 'gemini',
    bundledPath: existsSync(bundledPath) ? toRealPath(bundledPath) : undefined,
    cwd,
    defaultPackageName: GEMINI_CLI_PACKAGE,
    defaultVersion: GEMINI_CLI_VERSION,
    env
  })
}
