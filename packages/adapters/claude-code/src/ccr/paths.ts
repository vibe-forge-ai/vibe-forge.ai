import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, extname, resolve } from 'node:path'

const require = createRequire(import.meta.url ?? __filename)

export const toRealPath = (targetPath: string) => {
  try {
    return realpathSync(targetPath)
  } catch {
    return targetPath
  }
}

const resolvePackageDir = (packageName: string) => (
  dirname(require.resolve(`${packageName}/package.json`))
)

const resolvePackageBinPath = (packageName: string, binName?: string) => {
  const packageJSONPath = require.resolve(`${packageName}/package.json`)
  const packageDir = dirname(packageJSONPath)
  const packageJSON = JSON.parse(readFileSync(packageJSONPath, 'utf8')) as {
    bin?: string | Record<string, string>
  }

  const relativeBinPath = typeof packageJSON.bin === 'string'
    ? packageJSON.bin
    : typeof packageJSON.bin === 'object' && packageJSON.bin != null
    ? (
      (binName != null && packageJSON.bin[binName] != null)
        ? packageJSON.bin[binName]
        : Object.values(packageJSON.bin).find(value => typeof value === 'string')
    )
    : undefined

  if (relativeBinPath == null || relativeBinPath === '') {
    throw new Error(`Cannot resolve binary path for ${packageName}`)
  }

  return toRealPath(resolve(packageDir, relativeBinPath))
}

/**
 * Resolve the CCR (claude-code-router) binary path.
 * Resolved from the adapter dependency package.json instead of PATH.
 */
export const resolveAdapterCliPath = () => {
  return resolvePackageBinPath('@musistudio/claude-code-router', 'ccr')
}

/**
 * Resolve the Claude Code binary path from the adapter dependency graph.
 */
export const resolveClaudeCliPath = () => {
  return resolvePackageBinPath('@anthropic-ai/claude-code', 'claude')
}

const resolveTransformerCandidateNames = (name: string) => {
  const extension = extname(name)
  const baseName = extension === '' ? name : name.slice(0, -extension.length)

  return {
    source: [
      `${baseName}.ts`,
      `${baseName}.js`
    ],
    dist: [
      `${baseName}.js`,
      `${baseName}.mjs`,
      `${baseName}.cjs`
    ]
  }
}

export const resolveTransformerRuntimePreloadPath = () => {
  const adapterPackageDir = resolvePackageDir('@vibe-forge/adapter-claude-code')
  const candidates = [
    resolve(adapterPackageDir, '../../register/preload.js'),
    resolve(adapterPackageDir, '../../register/esbuild.js')
  ]

  const localRuntimePath = candidates.find(candidate => existsSync(candidate))
  if (localRuntimePath != null) {
    return toRealPath(localRuntimePath)
  }

  try {
    return toRealPath(require.resolve('esbuild-register'))
  } catch {
    return undefined
  }
}

export const resolveTransformerPath = (name: string) => {
  const adapterPackageDir = resolvePackageDir('@vibe-forge/adapter-claude-code')
  const candidateNames = resolveTransformerCandidateNames(name)
  const candidates = [
    ...[
      'src/ccr/transformers',
      'src/ccr-transformers',
      'ccr/transformers',
      'ccr-transformers'
    ].flatMap(baseDir => candidateNames.source.map(relativePath => (
      resolve(adapterPackageDir, baseDir, relativePath)
    ))),
    ...[
      'dist/ccr/transformers',
      'dist/ccr-transformers'
    ].flatMap(baseDir => candidateNames.dist.map(relativePath => (
      resolve(adapterPackageDir, baseDir, relativePath)
    )))
  ]

  return candidates.find(candidate => existsSync(candidate)) ?? candidates[0]
}
