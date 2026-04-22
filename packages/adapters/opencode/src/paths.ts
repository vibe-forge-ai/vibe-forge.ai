import { existsSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

import type { AdapterCtx } from '@vibe-forge/types'
import type { ManagedNpmCliConfig } from '@vibe-forge/utils/managed-npm-cli'
import { resolveManagedNpmCliBinaryPath } from '@vibe-forge/utils/managed-npm-cli'

const require = createRequire(import.meta.url ?? __filename)
const adapterPackageDir = dirname(require.resolve('@vibe-forge/adapter-opencode/package.json'))
const bundledPath = resolve(adapterPackageDir, 'node_modules/.bin/opencode')

export const OPENCODE_CLI_PACKAGE = 'opencode-ai'
export const OPENCODE_CLI_VERSION = '1.14.18'

export const toRealPath = (targetPath: string) => {
  try {
    return realpathSync(targetPath)
  } catch {
    return targetPath
  }
}

export const resolveOpenCodeBinaryPath = (
  env: AdapterCtx['env'],
  cwd?: string,
  config?: ManagedNpmCliConfig
): string => {
  const envPath = env.__VF_PROJECT_AI_ADAPTER_OPENCODE_CLI_PATH__
  if (typeof envPath === 'string' && envPath.trim() !== '') {
    return envPath
  }

  return resolveManagedNpmCliBinaryPath({
    adapterKey: 'opencode',
    binaryName: 'opencode',
    bundledPath: existsSync(bundledPath) ? toRealPath(bundledPath) : undefined,
    config,
    cwd,
    defaultPackageName: OPENCODE_CLI_PACKAGE,
    defaultVersion: OPENCODE_CLI_VERSION,
    env
  })
}
