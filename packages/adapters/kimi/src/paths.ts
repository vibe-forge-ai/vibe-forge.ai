import { existsSync, realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

import type { AdapterCtx } from '@vibe-forge/types'
import { resolveProjectSharedCachePath } from '@vibe-forge/utils/project-cache-path'

const KIMI_BINARY_NAMES = process.platform === 'win32'
  ? ['kimi.exe', 'kimi.cmd', 'kimi']
  : ['kimi']

const toRealPath = (targetPath: string) => {
  try {
    return realpathSync(targetPath)
  } catch {
    return targetPath
  }
}

export const resolveKimiManagedToolPaths = (
  cwd: string,
  env: AdapterCtx['env'] = process.env
) => {
  const rootDir = resolveProjectSharedCachePath(cwd, env, 'adapter-kimi', 'cli')
  const binDir = resolve(rootDir, 'bin')
  return {
    rootDir,
    toolDir: resolve(rootDir, 'tools'),
    binDir,
    cacheDir: resolve(rootDir, 'uv-cache'),
    pythonDir: resolve(rootDir, 'python'),
    pythonBinDir: resolve(rootDir, 'python-bin'),
    binaryCandidates: KIMI_BINARY_NAMES.map(fileName => resolve(binDir, fileName))
  }
}

export const resolveKimiManagedBinaryPath = (
  cwd?: string,
  env: AdapterCtx['env'] = process.env
) => {
  if (cwd == null || cwd.trim() === '') return undefined
  return resolveKimiManagedToolPaths(cwd, env).binaryCandidates
    .find(candidate => existsSync(candidate))
}

export const resolveKimiBinaryPath = (env: AdapterCtx['env'], cwd?: string) => {
  const envPath = env.__VF_PROJECT_AI_ADAPTER_KIMI_CLI_PATH__
  if (typeof envPath === 'string' && envPath.trim() !== '') {
    return envPath
  }

  const managedPath = resolveKimiManagedBinaryPath(cwd, env)
  if (managedPath != null) {
    return toRealPath(managedPath)
  }

  return 'kimi'
}
