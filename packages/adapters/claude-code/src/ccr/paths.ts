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

export const resolveTransformerPath = (relativePath: string) => {
  const distPath = resolve(adapterPackageDir, 'dist/ccr-transformers', relativePath)
  if (existsSync(distPath)) return distPath
  const srcPath = resolve(adapterPackageDir, 'src/ccr-transformers', relativePath)
  if (existsSync(srcPath)) return srcPath
  return resolve(adapterPackageDir, 'ccr-transformers', relativePath)
}
