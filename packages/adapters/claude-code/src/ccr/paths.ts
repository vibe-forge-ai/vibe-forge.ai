import { existsSync, realpathSync } from 'node:fs'
import { resolve } from 'node:path'

import type { AdapterCtx } from '@vibe-forge/core'

export const toRealPath = (targetPath: string) => {
  try {
    return realpathSync(targetPath)
  } catch {
    return targetPath
  }
}

export const resolveAdapterCliPath = (cwd: string, env: AdapterCtx['env']) => {
  const envCliPath = env.__VF_PROJECT_AI_ADAPTER_CLAUDE_CODE_CLI_PATH__
  let cliPath = typeof envCliPath === 'string' && envCliPath !== ''
    ? envCliPath
    : resolve(cwd, 'node_modules/.bin/ccr')
  if (cliPath.startsWith('.')) {
    cliPath = toRealPath(resolve(cwd, cliPath))
  }
  return cliPath
}

export const resolveTransformerPath = (cwd: string, relativePath: string) => {
  const distPath = resolve(cwd, 'node_modules/@vibe-forge/adapter-claude-code/dist', relativePath)
  if (existsSync(distPath)) return distPath
  const srcPath = resolve(cwd, 'node_modules/@vibe-forge/adapter-claude-code/src', relativePath)
  if (existsSync(srcPath)) return srcPath
  return resolve(cwd, relativePath)
}
