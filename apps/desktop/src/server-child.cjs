const fs = require('node:fs')
const path = require('node:path')

const resolveEsbuildBinaryPackageName = () => {
  if (process.platform === 'win32') {
    return `win32-${process.arch}`
  }

  return `${process.platform}-${process.arch}`
}

const resolveUnpackedAsarPath = (candidatePath) => {
  const marker = `${path.sep}app.asar${path.sep}`
  if (!candidatePath.includes(marker)) return undefined

  const unpackedPath = candidatePath.replace(marker, `${path.sep}app.asar.unpacked${path.sep}`)
  return fs.existsSync(unpackedPath) ? unpackedPath : undefined
}

const configurePackagedEsbuildBinary = () => {
  if (process.env.ESBUILD_BINARY_PATH) return

  let registerPackageDir
  try {
    registerPackageDir = path.dirname(require.resolve('@vibe-forge/register/package.json'))
  } catch {
    return
  }

  const binaryName = process.platform === 'win32' ? 'esbuild.exe' : 'esbuild'
  const asarBinaryPath = path.join(
    registerPackageDir,
    'node_modules',
    '@esbuild',
    resolveEsbuildBinaryPackageName(),
    'bin',
    binaryName
  )
  const unpackedBinaryPath = resolveUnpackedAsarPath(asarBinaryPath)
  if (unpackedBinaryPath != null) {
    process.env.ESBUILD_BINARY_PATH = unpackedBinaryPath
  }
}

configurePackagedEsbuildBinary()

const serverPackageDir = path.dirname(require.resolve('@vibe-forge/server/package.json'))

require('@vibe-forge/cli-helper/entry').runCliPackageEntrypoint({
  packageDir: serverPackageDir,
  sourceEntry: './src/index.ts',
  distEntry: './dist/__INTERNAL__home/index.js'
})
