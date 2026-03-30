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
  const candidates = [
    resolve(adapterPackageDir, 'dist/ccr/transformers', relativePath),
    resolve(adapterPackageDir, 'dist/ccr-transformers', relativePath),
    resolve(adapterPackageDir, 'src/ccr/transformers', relativePath),
    resolve(adapterPackageDir, 'src/ccr-transformers', relativePath),
    resolve(adapterPackageDir, 'ccr/transformers', relativePath),
    resolve(adapterPackageDir, 'ccr-transformers', relativePath)
  ]

  return candidates.find(candidate => existsSync(candidate)) ?? candidates[0]
}
