import { existsSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

import type { AdapterCtx } from '@vibe-forge/types'
import type { ManagedNpmCliConfig } from '@vibe-forge/utils/managed-npm-cli'
import { resolveManagedNpmCliBinaryPath } from '@vibe-forge/utils/managed-npm-cli'

const require = createRequire(import.meta.url ?? __filename)
const adapterPackageDir = dirname(require.resolve('@vibe-forge/adapter-copilot/package.json'))
const bundledPath = resolve(adapterPackageDir, 'node_modules/.bin/copilot')

export const COPILOT_CLI_PACKAGE = '@github/copilot'
export const COPILOT_CLI_VERSION = '1.0.36'

const toRealPath = (targetPath: string) => {
  try {
    return realpathSync(targetPath)
  } catch {
    return targetPath
  }
}

export const resolveCopilotBinaryPath = (
  env: AdapterCtx['env'],
  configuredPath?: string,
  cwd?: string,
  config?: ManagedNpmCliConfig
): string => {
  const envPath = env.__VF_PROJECT_AI_ADAPTER_COPILOT_CLI_PATH__
  if (typeof envPath === 'string' && envPath.trim() !== '') {
    return envPath
  }

  if (configuredPath != null && configuredPath.trim() !== '') {
    return configuredPath
  }

  return resolveManagedNpmCliBinaryPath({
    adapterKey: 'copilot',
    binaryName: 'copilot',
    bundledPath: existsSync(bundledPath) ? toRealPath(bundledPath) : undefined,
    config,
    configuredPath,
    cwd,
    defaultPackageName: COPILOT_CLI_PACKAGE,
    defaultVersion: COPILOT_CLI_VERSION,
    env
  })
}
