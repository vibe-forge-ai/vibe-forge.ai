import { existsSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url ?? __filename)

const adapterPackageDir = dirname(require.resolve('@vibe-forge/adapter-claude-code/package.json'))

export const toRealPath = (targetPath: string) => {
  try {
    return realpathSync(targetPath)
  } catch {
    return targetPath
  }
}

/**
 * Resolve the CCR (claude-code-router) binary path.
 * Resolved via `require.resolve` from the adapter package's dependencies.
 */
export const resolveAdapterCliPath = () => {
  return toRealPath(resolve(adapterPackageDir, 'node_modules/.bin/ccr'))
}

export const resolveTransformerPath = (cwd: string, relativePath: string) => {
  const distPath = resolve(cwd, 'node_modules/@vibe-forge/adapter-claude-code/dist', relativePath)
  if (existsSync(distPath)) return distPath
  const srcPath = resolve(cwd, 'node_modules/@vibe-forge/adapter-claude-code/src', relativePath)
  if (existsSync(srcPath)) return srcPath
  return resolve(cwd, relativePath)
}
